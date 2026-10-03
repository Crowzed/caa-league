'use client';

import { useState, useEffect } from 'react';
import { 
  Shield, User, Check, Save, Loader2, AlertCircle, CheckCircle, Info
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared';
import { createClient } from '@/lib/supabase/client';
import type { Guild } from '@/types/database';
import { ImageUpload } from '@/components/ui/image-upload';

export default function DashboardSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Profile fields
  const [displayName, setDisplayName] = useState('');
  const [robloxUsername, setRobloxUsername] = useState('');
  const [robloxId, setRobloxId] = useState('');
  const [discordUsername, setDiscordUsername] = useState('');
  const [playerBio, setPlayerBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Guild fields & permissions
  const [guild, setGuild] = useState<Guild | null>(null);
  const [isCaptain, setIsCaptain] = useState(false);
  const [guildDescription, setGuildDescription] = useState('');
  const [guildDiscordInvite, setGuildDiscordInvite] = useState('');
  const [guildLogoUrl, setGuildLogoUrl] = useState('');

  // Discord webhook fields (state preserved in code for future activation)
  // const [discordWebhook, setDiscordWebhook] = useState('https://discord.com/api/webhooks/...');
  // const [matchAlerts, setMatchAlerts] = useState(true);
  // const [rosterAlerts, setRosterAlerts] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function loadSettings() {
      try {
        setIsLoading(true);

        // Check local storage cache for player profile details
        let localData: {
          displayName?: string;
          robloxUsername?: string;
          discordUsername?: string;
          playerBio?: string;
        } | null = null;

        if (typeof window !== 'undefined') {
          try {
            const raw = localStorage.getItem('caa_dashboard_settings');
            if (raw) localData = JSON.parse(raw);
          } catch {
            // ignore JSON error
          }
        }

        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // 1. Fetch user's profile
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          if (profileData) {
            setDisplayName(profileData.display_name || profileData.username || '');
            setRobloxUsername(profileData.roblox_username || '');
            setRobloxId(profileData.roblox_id || '');
            setDiscordUsername(profileData.discord_username || '');
            setPlayerBio(profileData.bio || '');
            setAvatarUrl(profileData.avatar_url || '');
          } else if (localData) {
            setDisplayName(localData.displayName || '');
            setRobloxUsername(localData.robloxUsername || '');
            setDiscordUsername(localData.discordUsername || '');
            setPlayerBio(localData.playerBio || '');
          }

          // 2. Fetch user's guild membership & role
          const { data: memberData } = await supabase
            .from('guild_members')
            .select('role, guild:guilds(*)')
            .eq('player_id', user.id)
            .eq('is_active', true)
            .maybeSingle();

          let userGuild: Guild | null = null;
          let cap = false;

          if (memberData && memberData.guild) {
            userGuild = memberData.guild as unknown as Guild;
            if (memberData.role === 'captain' || memberData.role === 'co_captain') {
              cap = true;
            }
          } else {
            // Check if user is owner of a guild
            const { data: ownedGuild } = await supabase
              .from('guilds')
              .select('*')
              .eq('owner_id', user.id)
              .maybeSingle();
            if (ownedGuild) {
              userGuild = ownedGuild as Guild;
              cap = true;
            }
          }

          if (userGuild) {
            if (userGuild.owner_id === user.id) {
              cap = true;
            }
            setGuild(userGuild);
            setIsCaptain(cap);
            setGuildDescription(userGuild.description || '');
            setGuildDiscordInvite(userGuild.discord_invite || '');
            setGuildLogoUrl(userGuild.logo_url || '');
          } else {
            setGuild(null);
            setIsCaptain(false);
            setGuildDescription('');
            setGuildDiscordInvite('');
            setGuildLogoUrl('');
          }
        } else {
          // Unauthenticated Guest
          setGuild(null);
          setIsCaptain(false);
          setDisplayName(localData?.displayName || '');
          setRobloxUsername(localData?.robloxUsername || '');
          setDiscordUsername(localData?.discordUsername || '');
          setPlayerBio(localData?.playerBio || '');
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [supabase]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      // 1. Persist player identity to localStorage for offline cache
      const localData = {
        displayName,
        robloxUsername,
        discordUsername,
        playerBio,
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('caa_dashboard_settings', JSON.stringify(localData));
      }

      // 2. Persist to Supabase if authenticated
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            display_name: displayName.trim() || null,
            roblox_username: robloxUsername.trim() || null,
            discord_username: discordUsername.trim() || null,
            bio: playerBio.trim() || null,
            avatar_url: avatarUrl.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        if (profileError) {
          console.warn('Profile save warning:', profileError.message);
        }

        // Keep referees table synchronized if this user is an official
        const refUpdates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (displayName.trim()) refUpdates.display_name = displayName.trim();
        if (robloxUsername.trim()) refUpdates.roblox_username = robloxUsername.trim();
        if (discordUsername.trim()) refUpdates.discord_username = discordUsername.trim();

        await supabase
          .from('referees')
          .update(refUpdates)
          .eq('user_id', user.id);

        // Only captains and owners are authorized to update guild information
        if (guild?.id && isCaptain) {
          const { error: guildError } = await supabase
            .from('guilds')
            .update({
              description: guildDescription.trim() || null,
              discord_invite: guildDiscordInvite.trim() || null,
              logo_url: guildLogoUrl.trim() || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', guild.id);

          if (guildError) {
            console.warn('Guild save warning:', guildError.message);
          }
        }
      }

      setSaved(true);
      setFeedback({ type: 'success', message: 'Settings saved successfully!' });
      setTimeout(() => {
        setSaved(false);
        setFeedback(null);
      }, 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container py-8 max-w-4xl mx-auto space-y-8">
      <PageHeader
        title="Settings & Integrations"
        subtitle="Manage personal player identity and guild configuration"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings' },
        ]}
      />

      {feedback && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg border ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
              : 'bg-red-950/40 border-red-800/80 text-red-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
          )}
          <p className="text-sm font-medium">{feedback.message}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Player Identity (Always editable by the account owner) */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
          <h3 className="font-bold text-lg text-white flex items-center gap-2">
            <User className="w-5 h-5 text-blue-400" />
            Player Profile & Competitive Identity
          </h3>

          <div className="pb-2 border-b border-zinc-800/80">
            <ImageUpload
              value={avatarUrl}
              onChange={setAvatarUrl}
              bucket="avatars"
              shape="circle"
              label="Profile Picture (Avatar)"
              description="Upload a custom photo or avatar from your device (PNG, JPG, WEBP, GIF up to 5MB)."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="In-game or public display name"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="roblox">Roblox Username (Verified)</Label>
              <Input
                id="roblox"
                value={robloxUsername}
                onChange={(e) => setRobloxUsername(e.target.value)}
                placeholder="Roblox username"
                disabled={isLoading}
              />
              {robloxId && (
                <p className="text-[11px] text-zinc-500">
                  Connected with Roblox account ID: {robloxId}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="discord">Discord Handle</Label>
              <Input
                id="discord"
                value={discordUsername}
                onChange={(e) => setDiscordUsername(e.target.value)}
                placeholder="Discord username or handle"
                disabled={isLoading}
              />
              <p className="text-[11px] text-zinc-500">
                Used for referee match coordination and captain pings.
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="playerBio">Player Bio</Label>
              <Textarea
                id="playerBio"
                rows={2}
                value={playerBio}
                onChange={(e) => setPlayerBio(e.target.value)}
                placeholder="Short bio or personal notes..."
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        {/* Guild Settings (Conditioned on guild presence and captain permissions) */}
        {guild && isCaptain && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-400" />
                Guild Captain Settings — {guild.name}
              </h3>
              <Badge variant="default" className="text-xs">Captain Access</Badge>
            </div>

            <div className="space-y-4">
              <ImageUpload
                value={guildLogoUrl}
                onChange={setGuildLogoUrl}
                bucket="guild-logos"
                shape="square"
                label="Guild Official Logo / Crest"
                description="Upload your guild emblem or crest from your device (PNG, JPG, WEBP, GIF up to 5MB)."
              />

              <div className="space-y-2">
                <Label htmlFor="guildBio">Guild Public Description</Label>
                <Textarea
                  id="guildBio"
                  rows={3}
                  value={guildDescription}
                  onChange={(e) => setGuildDescription(e.target.value)}
                  placeholder="Guild description and introduction..."
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discordInvite">Guild Discord Invite Link</Label>
                <Input
                  id="discordInvite"
                  value={guildDiscordInvite}
                  onChange={(e) => setGuildDiscordInvite(e.target.value)}
                  placeholder="https://discord.gg/..."
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        )}

        {guild && !isCaptain && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-400" />
                Guild Information — {guild.name}
              </h3>
              <Badge variant="outline" className="text-xs text-zinc-400">Team Member (Read Only)</Badge>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950/50 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>
                You are registered as a member of <strong>{guild.name}</strong>. Only team captains and co-captains have permission to edit the guild&apos;s public description and Discord invite URL.
              </span>
            </div>

            <div className="space-y-3 pt-1 text-xs">
              <div>
                <span className="text-zinc-500 block mb-0.5">Guild Description</span>
                <p className="text-zinc-300 bg-zinc-950/30 p-2.5 rounded border border-zinc-800">
                  {guild.description || 'No description provided.'}
                </p>
              </div>
              <div>
                <span className="text-zinc-500 block mb-0.5">Discord Invite Link</span>
                <p className="text-zinc-300 font-mono bg-zinc-950/30 p-2.5 rounded border border-zinc-800">
                  {guild.discord_invite || 'No invite link connected.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {!guild && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="font-semibold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-zinc-500" />
                Guild Management Unavailable
              </h4>
              <p className="text-xs text-zinc-400">
                You do not own or belong to any guild. Register a new guild or join an existing team to unlock guild configuration.
              </p>
            </div>
            <Link href="/guilds/register">
              <Button size="sm" variant="outline" className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-xs whitespace-nowrap">
                Register a Guild
              </Button>
            </Link>
          </div>
        )}

        {/* 
          ========================================================================
          Discord Bot & Webhook Notifications (Hidden for now as requested)
          ========================================================================
          To re-enable: uncomment the block below and re-import Link2 & Switch.

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
          <h3 className="font-bold text-lg text-white flex items-center gap-2">
            <Link2 className="w-5 h-5 text-[#5865F2]" />
            Automated Discord Bot / Webhook Integration
          </h3>
          <p className="text-xs text-zinc-400">
            Receive instant match pings, lobby countdowns, and schedule change announcements directly into your guild&apos;s Discord server.
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook">Discord Webhook URL</Label>
              <Input
                id="webhook"
                value={discordWebhook}
                onChange={(e) => setDiscordWebhook(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/50 border border-zinc-800">
              <div>
                <p className="text-sm font-medium text-white">Upcoming Match Reminders</p>
                <p className="text-xs text-zinc-500">Send an automated ping 1 hour and 15 minutes before matches</p>
              </div>
              <Switch checked={matchAlerts} onCheckedChange={setMatchAlerts} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/50 border border-zinc-800">
              <div>
                <p className="text-sm font-medium text-white">Official Roster & Result Announcements</p>
                <p className="text-xs text-zinc-500">Broadcast confirmed match results and map scores</p>
              </div>
              <Switch checked={rosterAlerts} onCheckedChange={setRosterAlerts} />
            </div>
          </div>
        </div>
        */}

        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={isSaving || isLoading} className="gap-2">
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                Saving...
              </>
            ) : saved ? (
              <>
                <Check className="w-4 h-4 text-green-400" />
                Saved Changes
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
