"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  Users,
  Key,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Role, Permission, RoleConflict, RoleCategory } from "@/types/database";

interface RoleWithMeta extends Role {
  permission_count?: number;
  user_count?: number;
}

export default function RolesAdminPage() {
  const [roles, setRoles] = useState<RoleWithMeta[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [conflicts, setConflicts] = useState<RoleConflict[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("roles");

  // Notifications
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Role Create / Edit Dialog
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleFormData, setRoleFormData] = useState<{
    name: string;
    slug: string;
    description: string;
    category: RoleCategory;
    priority: number;
    status: "active" | "inactive";
  }>({
    name: "",
    slug: "",
    description: "",
    category: "staff",
    priority: 10,
    status: "active",
  });

  // Permission Editor Dialog
  const [isPermDialogOpen, setIsPermDialogOpen] = useState(false);
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<Role | null>(null);
  const [assignedPermIds, setAssignedPermIds] = useState<string[]>([]);
  const [isSavingPerms, setIsSavingPerms] = useState(false);

  // Conflict Dialog
  const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);
  const [conflictFormData, setConflictFormData] = useState<{
    role_a_id: string;
    role_b_id: string;
    reason: string;
    is_strict: boolean;
  }>({
    role_a_id: "",
    role_b_id: "",
    reason: "",
    is_strict: false,
  });

  // Assigned Users Dialog
  const [isUsersDialogOpen, setIsUsersDialogOpen] = useState(false);
  const [selectedRoleForUsers, setSelectedRoleForUsers] = useState<Role | null>(null);
  const [roleUsers, setRoleUsers] = useState<any[]>([]);
  const [isLoadingRoleUsers, setIsLoadingRoleUsers] = useState(false);

  const supabase = createClient();

  // Load all data
  const fetchData = async () => {
    try {
      setIsLoading(true);

      // 1. Fetch Roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("roles")
        .select("*")
        .order("priority", { ascending: false });

      if (rolesError) throw rolesError;

      // 2. Fetch Permissions
      const { data: permsData, error: permsError } = await supabase
        .from("permissions")
        .select("*")
        .order("category", { ascending: true });

      if (permsError) throw permsError;

      // 3. Fetch Role-Permission counts
      const { data: rpData } = await supabase
        .from("role_permissions")
        .select("role_id, permission_id");

      // 4. Fetch User-Role counts
      const { data: urData } = await supabase
        .from("user_roles")
        .select("role_id")
        .eq("status", "active");

      // 5. Fetch Conflicts
      const { data: confData } = await supabase
        .from("role_conflicts")
        .select(`
          id,
          role_a_id,
          role_b_id,
          reason,
          is_strict,
          created_at,
          role_a:roles!role_conflicts_role_a_id_fkey(name, slug),
          role_b:roles!role_conflicts_role_b_id_fkey(name, slug)
        `);

      const enrichedRoles: RoleWithMeta[] = (rolesData || []).map((role) => {
        const pCount = (rpData || []).filter((rp) => rp.role_id === role.id).length;
        const uCount = (urData || []).filter((ur) => ur.role_id === role.id).length;
        return {
          ...role,
          permission_count: pCount,
          user_count: uCount,
        };
      });

      setRoles(enrichedRoles);
      setPermissions(permsData || []);
      setConflicts((confData as any) || []);
    } catch (err: any) {
      console.error("Error loading roles data:", err);
      setErrorMessage(err.message || "Failed to load roles and permissions.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Open Create Role Modal
  const handleOpenCreateRole = () => {
    setEditingRole(null);
    setRoleFormData({
      name: "",
      slug: "",
      description: "",
      category: "staff",
      priority: 10,
      status: "active",
    });
    setIsRoleDialogOpen(true);
  };

  // Open Edit Role Modal
  const handleOpenEditRole = (role: Role) => {
    setEditingRole(role);
    setRoleFormData({
      name: role.name,
      slug: role.slug,
      description: role.description || "",
      category: role.category,
      priority: role.priority,
      status: role.status,
    });
    setIsRoleDialogOpen(true);
  };

  // Save Role
  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!roleFormData.name || !roleFormData.slug) {
        setErrorMessage("Name and Slug are required.");
        return;
      }

      if (editingRole) {
        const { error } = await supabase
          .from("roles")
          .update({
            name: roleFormData.name,
            slug: roleFormData.slug,
            description: roleFormData.description,
            category: roleFormData.category,
            priority: Number(roleFormData.priority),
            status: roleFormData.status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingRole.id);

        if (error) throw error;
        setSuccessMessage(`Role "${roleFormData.name}" updated successfully.`);
      } else {
        const { error } = await supabase.from("roles").insert({
          name: roleFormData.name,
          slug: roleFormData.slug.toLowerCase().replace(/\s+/g, "_"),
          description: roleFormData.description,
          category: roleFormData.category,
          priority: Number(roleFormData.priority),
          status: roleFormData.status,
          is_system: false,
        });

        if (error) throw error;
        setSuccessMessage(`Role "${roleFormData.name}" created successfully.`);
      }

      setIsRoleDialogOpen(false);
      fetchData();
    } catch (err: any) {
      setErrorMessage(err.message || "Error saving role.");
    }
  };

  // Open Permissions Dialog
  const handleOpenPermissions = async (role: Role) => {
    setSelectedRoleForPerms(role);
    try {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("permission_id")
        .eq("role_id", role.id);

      if (error) throw error;
      setAssignedPermIds((data || []).map((rp) => rp.permission_id));
      setIsPermDialogOpen(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Could not fetch permissions for role.");
    }
  };

  // Toggle permission check
  const handleTogglePermission = (permId: string) => {
    setAssignedPermIds((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  // Select all permissions in category
  const handleToggleCategory = (category: string) => {
    const categoryPerms = permissions.filter((p) => p.category === category);
    const categoryPermIds = categoryPerms.map((p) => p.id);
    const allSelected = categoryPermIds.every((id) => assignedPermIds.includes(id));

    if (allSelected) {
      setAssignedPermIds((prev) => prev.filter((id) => !categoryPermIds.includes(id)));
    } else {
      setAssignedPermIds((prev) => Array.from(new Set([...prev, ...categoryPermIds])));
    }
  };

  // Save Permissions
  const handleSavePermissions = async () => {
    if (!selectedRoleForPerms) return;
    try {
      setIsSavingPerms(true);
      await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", selectedRoleForPerms.id);

      if (assignedPermIds.length > 0) {
        const inserts = assignedPermIds.map((pId) => ({
          role_id: selectedRoleForPerms.id,
          permission_id: pId,
        }));
        const { error } = await supabase.from("role_permissions").insert(inserts);
        if (error) throw error;
      }

      setSuccessMessage(`Permissions updated for role "${selectedRoleForPerms.name}".`);
      setIsPermDialogOpen(false);
      fetchData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save permissions.");
    } finally {
      setIsSavingPerms(false);
    }
  };

  // Open Users Dialog
  const handleOpenUsers = async (role: Role) => {
    setSelectedRoleForUsers(role);
    setIsLoadingRoleUsers(true);
    setIsUsersDialogOpen(true);

    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select(`
          id,
          status,
          assigned_at,
          expires_at,
          reason,
          user:profiles!user_roles_user_id_fkey(id, username, display_name, avatar_url, roblox_username)
        `)
        .eq("role_id", role.id)
        .eq("status", "active")
        .order("assigned_at", { ascending: false });

      if (error) throw error;
      setRoleUsers(data || []);
    } catch (err: any) {
      console.error("Error loading role members:", err);
    } finally {
      setIsLoadingRoleUsers(false);
    }
  };

  // Save Role Conflict
  const handleSaveConflict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conflictFormData.role_a_id || !conflictFormData.role_b_id) {
      setErrorMessage("Please select two different roles.");
      return;
    }
    if (conflictFormData.role_a_id === conflictFormData.role_b_id) {
      setErrorMessage("Role A and Role B cannot be the same role.");
      return;
    }
    if (!conflictFormData.reason.trim()) {
      setErrorMessage("Please provide a reason for the role conflict.");
      return;
    }

    try {
      const { error } = await supabase.from("role_conflicts").insert({
        role_a_id: conflictFormData.role_a_id,
        role_b_id: conflictFormData.role_b_id,
        reason: conflictFormData.reason,
        is_strict: conflictFormData.is_strict,
      });

      if (error) throw error;

      setSuccessMessage("Role conflict rule configured successfully.");
      setIsConflictDialogOpen(false);
      setConflictFormData({
        role_a_id: "",
        role_b_id: "",
        reason: "",
        is_strict: false,
      });
      fetchData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to configure role conflict.");
    }
  };

  // Remove Conflict
  const handleDeleteConflict = async (conflictId: string) => {
    if (!confirm("Are you sure you want to remove this conflict rule?")) return;
    try {
      const { error } = await supabase.from("role_conflicts").delete().eq("id", conflictId);
      if (error) throw error;
      setSuccessMessage("Conflict rule removed.");
      fetchData();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to remove conflict rule.");
    }
  };

  // Group permissions by category
  const permissionsByCategory = permissions.reduce((acc, p) => {
    const cat = p.category || "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {} as Record<string, Permission[]>);

  const getCategoryBadge = (cat: RoleCategory) => {
    switch (cat) {
      case "staff":
        return <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30">Staff</Badge>;
      case "competitive":
        return <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30">Competitive</Badge>;
      case "community":
        return <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30">Community</Badge>;
      default:
        return <Badge variant="outline" className="border-slate-700 text-slate-400">Other</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions Management"
        description="Configure multi-role assignments, granular additive permissions, and conflict-of-interest rules."
        action={
          <div className="flex gap-2">
            <Button
              onClick={() => setIsConflictDialogOpen(true)}
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <ShieldAlert className="mr-2 h-4 w-4 text-amber-400" />
              Configure Conflict
            </Button>
            <Button
              onClick={handleOpenCreateRole}
              className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Role
            </Button>
          </div>
        }
      />

      {/* Alerts */}
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

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-100">{roles.length}</div>
              <div className="text-xs text-slate-400">Total Defined Roles</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-100">
                {roles.filter((r) => r.category === "staff").length}
              </div>
              <div className="text-xs text-slate-400">League Staff Roles</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-100">{permissions.length}</div>
              <div className="text-xs text-slate-400">Granular Permissions</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-red-500/10 text-red-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-100">{conflicts.length}</div>
              <div className="text-xs text-slate-400">Role Conflict Rules</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="roles" className="data-[state=active]:bg-slate-800 text-slate-300">
            <ShieldCheck className="h-4 w-4 mr-2" />
            Roles Catalog ({roles.length})
          </TabsTrigger>
          <TabsTrigger value="matrix" className="data-[state=active]:bg-slate-800 text-slate-300">
            <Key className="h-4 w-4 mr-2" />
            Permission Matrix
          </TabsTrigger>
          <TabsTrigger value="conflicts" className="data-[state=active]:bg-slate-800 text-slate-300">
            <ShieldAlert className="h-4 w-4 mr-2" />
            Conflict Rules ({conflicts.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Roles Catalog */}
        <TabsContent value="roles" className="space-y-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-950/60">
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400">Role Name & Slug</TableHead>
                    <TableHead className="text-slate-400">Category</TableHead>
                    <TableHead className="text-slate-400 text-center">Priority</TableHead>
                    <TableHead className="text-slate-400 text-center">Permissions</TableHead>
                    <TableHead className="text-slate-400 text-center">Active Members</TableHead>
                    <TableHead className="text-slate-400 text-center">Status</TableHead>
                    <TableHead className="text-right text-slate-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-slate-500">
                        Loading role catalogue...
                      </TableCell>
                    </TableRow>
                  ) : roles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-slate-500">
                        No roles defined.
                      </TableCell>
                    </TableRow>
                  ) : (
                    roles.map((role) => (
                      <TableRow key={role.id} className="border-slate-800 hover:bg-slate-800/40">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-100">{role.name}</span>
                            {role.is_system && (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-slate-700 text-slate-400"
                              >
                                System
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs font-mono text-slate-400">{role.slug}</div>
                          {role.description && (
                            <div className="text-xs text-slate-500 truncate max-w-xs mt-0.5">
                              {role.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{getCategoryBadge(role.category)}</TableCell>
                        <TableCell className="text-center font-mono text-sm text-amber-400">
                          {role.priority}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenPermissions(role)}
                            className="h-7 px-2.5 text-xs text-slate-300 hover:text-white bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50"
                          >
                            <Key className="h-3 w-3 mr-1.5 text-amber-400" />
                            {role.permission_count || 0} Grants
                          </Button>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenUsers(role)}
                            className="h-7 px-2.5 text-xs text-slate-300 hover:text-white bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50"
                          >
                            <Users className="h-3 w-3 mr-1.5 text-blue-400" />
                            {role.user_count || 0} Users
                          </Button>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={
                              role.status === "active"
                                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                : "bg-red-500/20 text-red-400 border border-red-500/30"
                            }
                          >
                            {role.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditRole(role)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-200"
                            >
                              <Edit2 className="h-4 w-4" />
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
        </TabsContent>

        {/* Tab 2: Permission Matrix */}
        <TabsContent value="matrix" className="space-y-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
                <Key className="h-5 w-5 text-amber-400" />
                Granular Permission Matrix
              </CardTitle>
              <CardDescription className="text-slate-400">
                Click any role to edit its specific capability set. Permissions are fully additive when multiple roles are assigned.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(permissionsByCategory).map(([category, perms]) => (
                  <div
                    key={category}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                      <span className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                        {category}
                      </span>
                      <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                        {perms.length} perms
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {perms.map((p) => (
                        <div key={p.id} className="text-xs">
                          <div className="font-medium text-slate-200">{p.name}</div>
                          <div className="text-[11px] font-mono text-slate-500">{p.code}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Conflict Rules */}
        <TabsContent value="conflicts" className="space-y-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-400" />
                  Role Conflict & Separation of Duty Rules
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Define incompatible roles. Strict conflicts completely block simultaneous assignment, while non-strict conflicts issue administrative warnings.
                </CardDescription>
              </div>
              <Button
                onClick={() => setIsConflictDialogOpen(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Conflict Rule
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-950/60">
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400">Role A</TableHead>
                    <TableHead className="text-slate-400">Role B</TableHead>
                    <TableHead className="text-slate-400">Enforcement</TableHead>
                    <TableHead className="text-slate-400">Conflict Rationale</TableHead>
                    <TableHead className="text-right text-slate-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conflicts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-slate-500">
                        No conflict rules defined. All multiple-role combinations are allowed by default.
                      </TableCell>
                    </TableRow>
                  ) : (
                    conflicts.map((conf) => (
                      <TableRow key={conf.id} className="border-slate-800 hover:bg-slate-800/40">
                        <TableCell>
                          <Badge className="bg-slate-800 text-slate-200 border-slate-700">
                            {(conf as any).role_a?.name || "Role A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-slate-800 text-slate-200 border-slate-700">
                            {(conf as any).role_b?.name || "Role B"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {conf.is_strict ? (
                            <Badge className="bg-red-500/20 text-red-400 border border-red-500/30">
                              Strict (Blocked)
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              Warning (Allowed)
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-slate-300 max-w-md">
                          {conf.reason}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteConflict(conf.id)}
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Role Create / Edit Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
          <form onSubmit={handleSaveRole}>
            <DialogHeader>
              <DialogTitle>{editingRole ? "Edit Role" : "Create New Role"}</DialogTitle>
              <DialogDescription className="text-slate-400">
                Define role metadata, priority weight, and organizational category.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Role Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Senior Referee"
                  value={roleFormData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setRoleFormData((prev) => ({
                      ...prev,
                      name,
                      slug: editingRole ? prev.slug : name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
                    }));
                  }}
                  className="bg-slate-950 border-slate-800"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug (Identifier)</Label>
                <Input
                  id="slug"
                  placeholder="e.g. senior_referee"
                  value={roleFormData.slug}
                  onChange={(e) =>
                    setRoleFormData((prev) => ({ ...prev, slug: e.target.value }))
                  }
                  className="bg-slate-950 border-slate-800 font-mono"
                  required
                  disabled={editingRole?.is_system}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={roleFormData.category}
                    onValueChange={(val: RoleCategory) =>
                      setRoleFormData((prev) => ({ ...prev, category: val }))
                    }
                  >
                    <SelectTrigger className="bg-slate-950 border-slate-800">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="competitive">Competitive</SelectItem>
                      <SelectItem value="community">Community</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority Order</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={roleFormData.priority}
                    onChange={(e) =>
                      setRoleFormData((prev) => ({ ...prev, priority: Number(e.target.value) }))
                    }
                    className="bg-slate-950 border-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Summary of responsibilities and authorization..."
                  value={roleFormData.description}
                  onChange={(e) =>
                    setRoleFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="bg-slate-950 border-slate-800 text-sm"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={roleFormData.status}
                  onValueChange={(val: "active" | "inactive") =>
                    setRoleFormData((prev) => ({ ...prev, status: val }))
                  }
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsRoleDialogOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-yellow-600 hover:bg-yellow-700 text-white">
                {editingRole ? "Save Changes" : "Create Role"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Permissions Assignment Dialog */}
      <Dialog open={isPermDialogOpen} onOpenChange={setIsPermDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-amber-400" />
              Manage Permissions for &quot;{selectedRoleForPerms?.name}&quot;
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Toggle specific capability grants for this role.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto space-y-6 py-4 pr-1">
            {Object.entries(permissionsByCategory).map(([category, perms]) => {
              const categoryPermIds = perms.map((p) => p.id);
              const allChecked = categoryPermIds.every((id) => assignedPermIds.includes(id));
              const someChecked =
                categoryPermIds.some((id) => assignedPermIds.includes(id)) && !allChecked;

              return (
                <div
                  key={category}
                  className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`cat-${category}`}
                        checked={allChecked ? true : someChecked ? "indeterminate" : false}
                        onCheckedChange={() => handleToggleCategory(category)}
                      />
                      <label
                        htmlFor={`cat-${category}`}
                        className="text-sm font-semibold uppercase tracking-wider text-slate-200 cursor-pointer"
                      >
                        {category}
                      </label>
                    </div>
                    <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                      {categoryPermIds.filter((id) => assignedPermIds.includes(id)).length} /{" "}
                      {perms.length}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {perms.map((p) => {
                      const isChecked = assignedPermIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleTogglePermission(p.id)}
                          className={`flex items-start gap-2.5 p-2 rounded-lg border transition-colors cursor-pointer ${
                            isChecked
                              ? "bg-amber-500/10 border-amber-500/30 text-slate-100"
                              : "bg-slate-900/60 border-slate-800/80 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => handleTogglePermission(p.id)}
                            className="mt-0.5"
                          />
                          <div className="space-y-0.5">
                            <div className="text-xs font-medium text-slate-200">{p.name}</div>
                            <div className="text-[10px] font-mono text-slate-500">{p.code}</div>
                            {p.description && (
                              <div className="text-[11px] text-slate-400 leading-tight">
                                {p.description}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsPermDialogOpen(false)}
              className="text-slate-400 hover:text-slate-200"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSavingPerms}
              onClick={handleSavePermissions}
              className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium"
            >
              {isSavingPerms ? "Saving..." : "Save Permission Grants"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Conflict Dialog */}
      <Dialog open={isConflictDialogOpen} onOpenChange={setIsConflictDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
          <form onSubmit={handleSaveConflict}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-400" />
                Configure Role Conflict Rule
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Specify roles that cannot be assigned together or require strict separation.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Role A</Label>
                <Select
                  value={conflictFormData.role_a_id}
                  onValueChange={(val) =>
                    setConflictFormData((prev) => ({ ...prev, role_a_id: val }))
                  }
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800">
                    <SelectValue placeholder="Select first role" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} ({r.slug})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Role B</Label>
                <Select
                  value={conflictFormData.role_b_id}
                  onValueChange={(val) =>
                    setConflictFormData((prev) => ({ ...prev, role_b_id: val }))
                  }
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800">
                    <SelectValue placeholder="Select second role" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    {roles
                      .filter((r) => r.id !== conflictFormData.role_a_id)
                      .map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name} ({r.slug})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Conflict Rationale</Label>
                <Textarea
                  id="reason"
                  placeholder="Explain why holding both roles creates a conflict of interest..."
                  value={conflictFormData.reason}
                  onChange={(e) =>
                    setConflictFormData((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  className="bg-slate-950 border-slate-800 text-sm"
                  rows={3}
                  required
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium text-slate-200">Strict Enforcement</div>
                  <div className="text-xs text-slate-400">
                    If enabled, completely blocks assigning both roles. If disabled, shows a warning.
                  </div>
                </div>
                <Switch
                  checked={conflictFormData.is_strict}
                  onCheckedChange={(val) =>
                    setConflictFormData((prev) => ({ ...prev, is_strict: val }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsConflictDialogOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-medium">
                Save Conflict Rule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Users with Role Dialog */}
      <Dialog open={isUsersDialogOpen} onOpenChange={setIsUsersDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-400" />
              Users with &quot;{selectedRoleForUsers?.name}&quot;
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Active accounts currently holding this role assignment.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 max-h-80 overflow-y-auto space-y-2">
            {isLoadingRoleUsers ? (
              <div className="text-center py-6 text-slate-500">Loading members...</div>
            ) : roleUsers.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                No active users currently assigned this role.
              </div>
            ) : (
              roleUsers.map((ur) => (
                <div
                  key={ur.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-200">
                      {ur.user?.display_name || ur.user?.username || "Unknown User"}
                    </div>
                    <div className="text-xs text-slate-500">
                      @{ur.user?.username} {ur.user?.roblox_username && `(Roblox: ${ur.user.roblox_username})`}
                    </div>
                    {ur.expires_at && (
                      <div className="text-[11px] text-amber-400 flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        Expires: {new Date(ur.expires_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <Badge className="bg-green-500/20 text-green-400 border border-green-500/30 text-xs">
                    Active
                  </Badge>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsUsersDialogOpen(false)}
              className="text-slate-400 hover:text-slate-200"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
