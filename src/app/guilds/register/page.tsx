'use client';

import { motion } from 'framer-motion';
import { Shield, CheckCircle2, AlertCircle, ArrowRight, UserCheck, ShieldAlert, FileText, Check, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared';
import { createClient } from '@/lib/supabase/client';
import { ImageUpload } from '@/components/ui/image-upload';

const regions = ['NA', 'EU', 'APAC', 'SA', 'OCE', 'Other'];

export default function GuildRegistrationPage() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedGuildName, setSubmittedGuildName] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    tag: '',
    description: '',
    region: 'NA',
    logo_url: '',
    // Verification Requirements
    roblox_group_id: '',
    roblox_group_url: '',
    discord_invite: '',
    captain_roblox_username: '',
    captain_discord: '',
    verification_proof_url: '',
    verification_notes: '',
  });

  const supabase = createClient();

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('roblox_username, discord_username')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          setFormData((prev) => ({
            ...prev,
            captain_roblox_username: prev.captain_roblox_username || profile.roblox_username || '',
            captain_discord: prev.captain_discord || profile.discord_username || '',
          }));
        }
      }
    }
    checkAuth();
  }, [supabase]);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.tag.trim() || !formData.region) {
      setErrorMessage('Please fill in all required guild information in Step 1.');
      return;
    }

    if (!formData.roblox_group_id.trim() && !formData.roblox_group_url.trim()) {
      setErrorMessage('Verification error: Please provide your official Roblox Group ID or Link.');
      return;
    }

    if (!formData.captain_roblox_username.trim()) {
      setErrorMessage('Please provide your Roblox username to verify leadership.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Check logged in user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErrorMessage('You must be logged in to submit a guild registration. Please log in first.');
        setIsSubmitting(false);
        return;
      }

      // 2. Check for duplicate/spam applications
      const { data: existingGuild } = await supabase
        .from('guilds')
        .select('id, name, status')
        .eq('owner_id', user.id)
        .in('status', ['pending', 'approved', 'active'])
        .maybeSingle();

      if (existingGuild) {
        setErrorMessage(`You already have an active/pending guild registered (${existingGuild.name} — ${existingGuild.status.toUpperCase()}). Each leader can only register one guild at a time.`);
        setIsSubmitting(false);
        return;
      }

      // Ensure captain profile exists in profiles table before referencing owner_id
      const { data: profileCheck } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profileCheck) {
        await supabase.from('profiles').upsert({
          id: user.id,
          username: user.user_metadata?.username || user.email?.split('@')[0] || `captain_${user.id.slice(0, 8)}`,
          display_name: formData.captain_roblox_username.trim() || user.user_metadata?.display_name || user.email?.split('@')[0] || 'Team Captain',
          email: user.email,
          roblox_username: formData.captain_roblox_username.trim() || null,
          discord_username: formData.captain_discord.trim() || null,
          role: 'guild_captain',
          account_status: 'registered',
          guild_status: 'unaffiliated',
          is_verified: false,
        });
      }

      // 3. Insert guild into Supabase with 'pending' status & empty roster
      const newGuildId = crypto.randomUUID();
      const combinedNotes = [
        formData.description.trim(),
        formData.roblox_group_id ? `[Roblox Group: ${formData.roblox_group_id.trim()}]` : null,
        formData.roblox_group_url ? `[Group URL: ${formData.roblox_group_url.trim()}]` : null,
        formData.verification_proof_url ? `[Proof Link: ${formData.verification_proof_url.trim()}]` : null,
        formData.verification_notes ? `[Verification Notes: ${formData.verification_notes.trim()}]` : null,
      ].filter(Boolean).join('\n\n');

      const { error: guildError } = await supabase.from('guilds').insert({
        id: newGuildId,
        name: formData.name.trim(),
        tag: formData.tag.trim().toUpperCase(),
        description: combinedNotes || null,
        region: formData.region,
        logo_url: formData.logo_url.trim() || null,
        discord_invite: formData.discord_invite.trim() || null,
        owner_id: user.id,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (guildError) {
        setErrorMessage(guildError.message);
        setIsSubmitting(false);
        return;
      }

      // 4. Update captain's profile & add captain as first member (leaving the rest of the roster for the captain to fill)
      await supabase.from('profiles').update({
        role: 'guild_captain',
        roblox_username: formData.captain_roblox_username.trim() || undefined,
        discord_username: formData.captain_discord.trim() || undefined,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);

      await supabase.from('guild_members').insert({
        id: crypto.randomUUID(),
        guild_id: newGuildId,
        player_id: user.id,
        role: 'captain',
        joined_at: new Date().toISOString(),
        is_active: true,
        created_at: new Date().toISOString(),
      });

      // 5. Initialize clean 0-0-0 guild statistics for current season
      const { data: currentSeason } = await supabase
        .from('seasons')
        .select('id')
        .eq('is_current', true)
        .maybeSingle();

      if (currentSeason) {
        await supabase.from('guild_statistics').insert({
          id: crypto.randomUUID(),
          guild_id: newGuildId,
          season_id: currentSeason.id,
          matches_played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          maps_won: 0,
          maps_lost: 0,
          points: 0,
          longest_win_streak: 0,
          current_streak: 0,
          attack_wins: 0,
          defense_wins: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      setSubmittedGuildName(formData.name.trim());
      setIsSubmitted(true);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to submit guild application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Register Your Guild"
        subtitle="Official CAA League guild qualification and leadership verification portal"
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Guilds', href: '/guilds' }, { label: 'Register' }]}
      />

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {!currentUserId && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="text-sm">You must be signed in with your account to register a guild.</span>
            </div>
            <Link href="/login">
              <Button size="sm" variant="outline" className="border-amber-500/40 text-amber-300 hover:bg-amber-500/20">
                Log In
              </Button>
            </Link>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span className="text-sm font-medium">{errorMessage}</span>
          </div>
        )}

        {isSubmitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur p-8 text-center space-y-6 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-green-500 rounded-full blur-[2px]" />
            <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto text-green-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Guild Application Submitted!</h2>
              <p className="text-zinc-400 text-sm max-w-md mx-auto">
                Your guild application for <strong className="text-white">{submittedGuildName}</strong> and verification credentials have been sent to league administrators.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <Shield className="w-3.5 h-3.5" /> Status: Pending Administrator Review
            </div>

            <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 text-left text-xs text-zinc-400 space-y-2 max-w-lg mx-auto">
              <p className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-400" /> Roster Management Policy:
              </p>
              <p>
                Your roster starts clean. Once league administrators approve your guild application, you can invite and fill your 6-player roster (Captain, Co-Captain, 3 Starters, and 1 Sub) directly from your <strong>Team Dashboard</strong>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4 border-t border-zinc-800">
              <Link href="/dashboard">
                <Button variant="default" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                  Go to Team Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/guilds">
                <Button variant="outline" className="w-full sm:w-auto border-zinc-700 text-zinc-300">
                  View Public Directory
                </Button>
              </Link>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Steps Indicator */}
            <div className="flex items-center justify-center gap-3 mb-8">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                    step >= s ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                  }`}>
                    {step > s ? <Check className="w-4 h-4" /> : s}
                  </div>
                  <span className={`text-xs font-medium hidden sm:inline ${step >= s ? 'text-white' : 'text-zinc-500'}`}>
                    {s === 1 && 'Guild Identity'}
                    {s === 2 && 'Verification & Proof'}
                    {s === 3 && 'Review & Submit'}
                  </span>
                  {s < 3 && <div className={`w-12 h-0.5 ${step > s ? 'bg-blue-600' : 'bg-zinc-800'}`} />}
                </div>
              ))}
            </div>

            {/* Step 1: Guild Identity */}
            {step === 1 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800">
                <div className="border-b border-zinc-800 pb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-400" /> Guild Identity
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Enter the public name, clan tag, and region for your competitive organization.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-zinc-300">Guild Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Shadow Legion"
                      value={formData.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      className="mt-1 bg-zinc-950 border-zinc-800 text-white"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="tag" className="text-zinc-300">Guild Tag * (2-5 characters)</Label>
                      <Input
                        id="tag"
                        placeholder="e.g., SHL"
                        value={formData.tag}
                        onChange={(e) => updateField('tag', e.target.value.toUpperCase())}
                        maxLength={5}
                        className="mt-1 bg-zinc-950 border-zinc-800 text-white uppercase font-mono"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="region" className="text-zinc-300">Competitive Region *</Label>
                      <select
                        id="region"
                        value={formData.region}
                        onChange={(e) => updateField('region', e.target.value)}
                        className="mt-1 w-full h-10 px-3 rounded-md bg-zinc-950 border border-zinc-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        {regions.map((r) => (
                          <option key={r} value={r} className="bg-zinc-900">{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <ImageUpload
                    value={formData.logo_url}
                    onChange={(url) => updateField('logo_url', url)}
                    bucket="guild-logos"
                    shape="square"
                    label="Guild Logo / Crest (Upload Image)"
                    description="Upload an official team logo or crest from your device (PNG, JPG, WEBP, GIF up to 5MB)."
                  />

                  <div>
                    <Label htmlFor="description" className="text-zinc-300">Guild Description & Background</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief background about your guild, competitive achievements, playstyle, and goals..."
                      value={formData.description}
                      onChange={(e) => updateField('description', e.target.value)}
                      rows={3}
                      className="mt-1 bg-zinc-950 border-zinc-800 text-white resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-zinc-800">
                  <Button
                    onClick={() => {
                      if (!formData.name.trim() || !formData.tag.trim() || !formData.region) {
                        setErrorMessage('Please fill in Guild Name, Tag, and Region.');
                        return;
                      }
                      setErrorMessage(null);
                      setStep(2);
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Continue to Verification <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Verification Requirements */}
            {step === 2 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800">
                <div className="border-b border-zinc-800 pb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-amber-400" /> Leadership & Group Verification
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    To prevent fake registrations and spam, you must provide proof of ownership for your Roblox group or in-game Command An Army clan.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="roblox_group_id" className="text-zinc-300">Roblox Group ID *</Label>
                      <Input
                        id="roblox_group_id"
                        placeholder="e.g., 34567890"
                        value={formData.roblox_group_id}
                        onChange={(e) => updateField('roblox_group_id', e.target.value)}
                        className="mt-1 bg-zinc-950 border-zinc-800 text-white font-mono"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="roblox_group_url" className="text-zinc-300">Roblox Group Link</Label>
                      <Input
                        id="roblox_group_url"
                        placeholder="https://www.roblox.com/groups/..."
                        value={formData.roblox_group_url}
                        onChange={(e) => updateField('roblox_group_url', e.target.value)}
                        className="mt-1 bg-zinc-950 border-zinc-800 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="captain_roblox" className="text-zinc-300">Captain&apos;s Roblox Username *</Label>
                      <Input
                        id="captain_roblox"
                        placeholder="e.g., CommanderCAA"
                        value={formData.captain_roblox_username}
                        onChange={(e) => updateField('captain_roblox_username', e.target.value)}
                        className="mt-1 bg-zinc-950 border-zinc-800 text-white"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="captain_discord" className="text-zinc-300">Captain&apos;s Discord Tag</Label>
                      <Input
                        id="captain_discord"
                        placeholder="e.g., Commander#0001 or commander_caa"
                        value={formData.captain_discord}
                        onChange={(e) => updateField('captain_discord', e.target.value)}
                        className="mt-1 bg-zinc-950 border-zinc-800 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="discord_invite" className="text-zinc-300">Guild Discord Server Invite</Label>
                    <Input
                      id="discord_invite"
                      placeholder="https://discord.gg/your-guild"
                      value={formData.discord_invite}
                      onChange={(e) => updateField('discord_invite', e.target.value)}
                      className="mt-1 bg-zinc-950 border-zinc-800 text-white"
                    />
                  </div>

                  <div>
                    <Label htmlFor="verification_proof" className="text-zinc-300">Proof Link / Screenshot URL (Optional)</Label>
                    <Input
                      id="verification_proof"
                      placeholder="https://imgur.com/..., Discord cdn, or image link showing group/clan ownership"
                      value={formData.verification_proof_url}
                      onChange={(e) => updateField('verification_proof_url', e.target.value)}
                      className="mt-1 bg-zinc-950 border-zinc-800 text-white"
                    />
                    <p className="text-[11px] text-zinc-500 mt-1">
                      A screenshot showing your Roblox account with Group Owner rank or in-game clan management accelerates admin approval.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="notes" className="text-zinc-300">Additional Notes for Administrators</Label>
                    <Textarea
                      id="notes"
                      placeholder="Any additional information to assist administrators in verifying your organization..."
                      value={formData.verification_notes}
                      onChange={(e) => updateField('verification_notes', e.target.value)}
                      rows={2}
                      className="mt-1 bg-zinc-950 border-zinc-800 text-white resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-4 border-t border-zinc-800">
                  <Button variant="ghost" onClick={() => setStep(1)} className="text-zinc-400">
                    Back
                  </Button>
                  <Button
                    onClick={() => {
                      if (!formData.roblox_group_id.trim() && !formData.roblox_group_url.trim()) {
                        setErrorMessage('Please provide your Roblox Group ID or Link for verification.');
                        return;
                      }
                      if (!formData.captain_roblox_username.trim()) {
                        setErrorMessage('Please provide your Captain Roblox Username.');
                        return;
                      }
                      setErrorMessage(null);
                      setStep(3);
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Review Application <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Review & Submit */}
            {step === 3 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800">
                <div className="border-b border-zinc-800 pb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-green-400" /> Review & Submit
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Confirm your organization details. Roster management will be available directly in your Dashboard once approved.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3 text-sm">
                  <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                    <span className="text-zinc-400">Guild Name:</span>
                    <span className="font-bold text-white">{formData.name} [{formData.tag}]</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                    <span className="text-zinc-400">Region:</span>
                    <span className="text-zinc-200">{formData.region}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                    <span className="text-zinc-400">Roblox Group:</span>
                    <span className="text-zinc-200 font-mono">{formData.roblox_group_id || 'Provided via Link'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                    <span className="text-zinc-400">Captain Roblox:</span>
                    <span className="text-zinc-200">{formData.captain_roblox_username}</span>
                  </div>
                  {formData.discord_invite && (
                    <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-400">Discord Server:</span>
                      <span className="text-blue-400 truncate max-w-xs">{formData.discord_invite}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-1">
                    <span className="text-zinc-400">Initial Roster:</span>
                    <span className="text-amber-400 font-semibold">Starts Empty (Leader Fills via Dashboard)</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-600/10 border border-blue-500/30 text-xs text-blue-300 space-y-2">
                  <p className="font-semibold flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-blue-400" /> League Policy & Fair Play Agreement:
                  </p>
                  <p>
                    By submitting this application, you declare that you are the authentic owner/leader of this Roblox group. All newly approved guilds begin with a clean 0-0-0 record and must field 6 players per match in official CAA League tournaments.
                  </p>
                </div>

                <div className="flex justify-between pt-4 border-t border-zinc-800">
                  <Button variant="ghost" onClick={() => setStep(2)} className="text-zinc-400">
                    Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Submitting Application...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        <span>Submit Guild for Review</span>
                      </div>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
