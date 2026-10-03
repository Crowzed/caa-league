import { SupabaseClient } from '@supabase/supabase-js';
import { UserActiveRole } from '@/types/database';

export interface RoleConflictWarning {
  conflictingRoleName: string;
  reason: string;
  isStrict: boolean;
}

/**
 * Fetch all active roles held by a specific user.
 * Combines role priority, metadata, and handles expired roles.
 */
export async function getUserRoles(
  supabase: SupabaseClient,
  userId: string
): Promise<UserActiveRole[]> {
  try {
    const { data, error } = await supabase.rpc('get_user_roles', {
      p_user_id: userId,
    });

    if (error) {
      console.warn('Fallback fetching user roles without rpc:', error);
      // Fallback query if RPC fails
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('user_roles')
        .select(`
          id,
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
        .eq('user_id', userId)
        .eq('status', 'active');

      if (fallbackError || !fallbackData) return [];

      return (fallbackData as any[])
        .filter((ur) => ur.roles && (!ur.expires_at || new Date(ur.expires_at) > new Date()))
        .map((ur) => ({
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
    }

    return (data as UserActiveRole[]) || [];
  } catch (err) {
    console.error('Unexpected error fetching user roles:', err);
    return [];
  }
}

/**
 * Fetch the additive set of permission codes for a specific user across all their active roles.
 */
export async function getUserPermissions(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc('get_user_permissions', {
      p_user_id: userId,
    });

    if (error) {
      console.warn('Fallback fetching permissions without rpc:', error);
      // Fallback query
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', userId)
        .eq('status', 'active');

      if (!userRoles || userRoles.length === 0) return [];

      const roleIds = userRoles.map((r) => r.role_id);
      const { data: rolePerms } = await supabase
        .from('role_permissions')
        .select('permissions (code)')
        .in('role_id', roleIds);

      if (!rolePerms) return [];

      const permSet = new Set<string>();
      rolePerms.forEach((rp: any) => {
        if (rp.permissions?.code) {
          permSet.add(rp.permissions.code);
        }
      });
      return Array.from(permSet);
    }

    return ((data as any[]) || []).map((row) => row.permission_code || row);
  } catch (err) {
    console.error('Unexpected error fetching permissions:', err);
    return [];
  }
}

/**
 * Check if a list of permission codes satisfies a required permission.
 */
export function hasPermission(
  userPermissions: string[],
  requiredCode: string
): boolean {
  if (!userPermissions || userPermissions.length === 0) return false;
  return userPermissions.includes(requiredCode);
}

/**
 * Check if a list of permission codes satisfies ANY of the required permissions.
 */
export function hasAnyPermission(
  userPermissions: string[],
  requiredCodes: string[]
): boolean {
  if (!userPermissions || userPermissions.length === 0) return false;
  return requiredCodes.some((code) => userPermissions.includes(code));
}

/**
 * Check if a list of permission codes satisfies ALL of the required permissions.
 */
export function hasAllPermissions(
  userPermissions: string[],
  requiredCodes: string[]
): boolean {
  if (!userPermissions || userPermissions.length === 0) return false;
  return requiredCodes.every((code) => userPermissions.includes(code));
}

/**
 * Check if assigning a new role conflicts with any of the user's currently active roles.
 */
export async function checkRoleConflicts(
  supabase: SupabaseClient,
  userId: string,
  newRoleId: string
): Promise<RoleConflictWarning[]> {
  try {
    const { data, error } = await supabase.rpc('check_role_conflicts', {
      p_user_id: userId,
      p_new_role_id: newRoleId,
    });

    if (error) {
      console.warn('Error checking role conflicts via rpc:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      conflictingRoleName: row.conflicting_role_name,
      reason: row.reason,
      isStrict: Boolean(row.is_strict),
    }));
  } catch (err) {
    console.error('Unexpected error in checkRoleConflicts:', err);
    return [];
  }
}

/**
 * Conflict-of-interest enforcement:
 * Checks whether a referee has a conflict of interest for a given match.
 * A referee cannot officiate a match if they are a member, captain, or owner
 * of either participating guild.
 */
export async function isRefereeMatchConflicted(
  supabase: SupabaseClient,
  refereeUserId: string,
  homeGuildId?: string | null,
  awayGuildId?: string | null
): Promise<{ isConflicted: boolean; reason?: string }> {
  if (!refereeUserId || (!homeGuildId && !awayGuildId)) {
    return { isConflicted: false };
  }

  try {
    const guildIds = [homeGuildId, awayGuildId].filter(Boolean) as string[];

    // 1. Check if user is a member of either guild
    const { data: membership, error: memError } = await supabase
      .from('guild_members')
      .select('guild_id, role, guilds (name)')
      .eq('user_id', refereeUserId)
      .in('guild_id', guildIds)
      .limit(1);

    if (!memError && membership && membership.length > 0) {
      const match = membership[0];
      const guildName = (match.guilds as any)?.name || 'participating guild';
      return {
        isConflicted: true,
        reason: `Referee is an active ${match.role} of ${guildName}.`,
      };
    }

    // 2. Check if user is the owner/creator of either guild
    const { data: ownedGuilds, error: ownError } = await supabase
      .from('guilds')
      .select('name')
      .in('id', guildIds)
      .eq('owner_id', refereeUserId)
      .limit(1);

    if (!ownError && ownedGuilds && ownedGuilds.length > 0) {
      return {
        isConflicted: true,
        reason: `Referee is the owner of ${ownedGuilds[0].name}.`,
      };
    }

    return { isConflicted: false };
  } catch (err) {
    console.error('Error verifying referee conflict-of-interest:', err);
    return { isConflicted: false };
  }
}

