'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Shield, CheckCircle2, AlertCircle, ArrowLeft, Send, 
  Clock, Calendar, Award, User, HelpCircle, Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import type { RefereeApplication, Profile } from '@/types/database';

export default function RefereeApplicationPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [existingApp, setExistingApp] = useState<RefereeApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State
  const [robloxUsername, setRobloxUsername] = useState('');
  const [discordUsername, setDiscordUsername] = useState('');
  const [region, setRegion] = useState('Asia/Pacific');
  const [timezone, setTimezone] = useState('WIB (UTC+7)');
  const [experience, setExperience] = useState('');
  const [availability, setAvailability] = useState('');
  const [preferredMatchTimes, setPreferredMatchTimes] = useState('');
  const [motivation, setMotivation] = useState('');
  const [relevantExperience, setRelevantExperience] = useState('');
  const [rulesAgreed, setRulesAgreed] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login?next=/referees/apply');
          return;
        }

        const { data: userProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (userProfile) {
          setProfile(userProfile);
          setRobloxUsername(userProfile.roblox_username || '');
          setDiscordUsername(userProfile.discord_username || '');
        }

        // Check if existing application
        const { data: myApps } = await supabase
          .from('referee_applications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (myApps && myApps.length > 0) {
          setExistingApp(myApps[0]);
        }
      } catch (err) {
        console.warn('Error loading applicant data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [supabase, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!rulesAgreed) {
      setFeedback({ type: 'error', message: 'You must read and agree to the Official Referee Rules and Code of Conduct.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/referees/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roblox_username: robloxUsername,
          discord_username: discordUsername,
          region,
          timezone,
          experience,
          availability,
          preferred_match_times: preferredMatchTimes,
          motivation,
          relevant_experience: relevantExperience,
          rules_agreed: rulesAgreed,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback({ type: 'error', message: data.error || 'Failed to submit application.' });
      } else {
        setFeedback({
          type: 'success',
          message: 'Your referee application has been submitted successfully! League administrators will review it shortly.',
        });
        setExistingApp(data.application);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error submitting application.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="container py-10 max-w-3xl mx-auto space-y-8">
      <div>
        <Link href="/referees" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Referees Directory
        </Link>
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
          <Shield className="w-3.5 h-3.5" />
          <span>Official Recruitment</span>
        </div>
        <h1 className="text-3xl font-black text-white">Apply to Become a League Referee</h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Referees are official league staff appointed to uphold fair competition, verify tournament check-ins, record map results, and adjudicate rule compliance during official fixtures.
        </p>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl border text-sm flex items-start gap-3 ${
          feedback.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Existing Application Tracker */}
      {existingApp && existingApp.status !== 'rejected' && existingApp.status !== 'withdrawn' ? (
        <div className="p-6 rounded-2xl border border-blue-500/30 bg-blue-500/5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-base">Your Active Application</h3>
            <Badge variant="outline" className="uppercase font-mono text-xs border-blue-500/40 text-blue-400 bg-blue-500/10">
              Status: {existingApp.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-xs text-zinc-300">
            You submitted an application on <strong>{new Date(existingApp.created_at).toLocaleDateString()}</strong>.
            League staff are currently reviewing candidate profiles. You do not need to reapply.
          </p>
          {existingApp.reviewer_notes && (
            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
              <span className="font-semibold text-white">Staff Notes: </span>
              {existingApp.reviewer_notes}
            </div>
          )}
          <div className="pt-2">
            <Link href="/referees">
              <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 text-xs">
                Browse League Referees
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 md:p-8">
          {/* Section 1: Candidate Identity */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2 pb-2 border-b border-zinc-800">
              <User className="w-4 h-4 text-blue-400" /> Candidate Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-zinc-400">Website Username</Label>
                <Input
                  disabled
                  value={profile?.username || ''}
                  className="mt-1 bg-zinc-950 border-zinc-800 text-zinc-400 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Display Name</Label>
                <Input
                  disabled
                  value={profile?.display_name || profile?.username || ''}
                  className="mt-1 bg-zinc-950 border-zinc-800 text-zinc-400 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Roblox Username *</Label>
                <Input
                  required
                  value={robloxUsername}
                  onChange={(e) => setRobloxUsername(e.target.value)}
                  placeholder="Roblox handle"
                  className="mt-1 bg-zinc-950 border-zinc-800 text-white text-xs"
                />
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Discord Username / ID *</Label>
                <Input
                  required
                  value={discordUsername}
                  onChange={(e) => setDiscordUsername(e.target.value)}
                  placeholder="e.g. username#0000 or username"
                  className="mt-1 bg-zinc-950 border-zinc-800 text-white text-xs"
                />
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Region *</Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger className="mt-1 bg-zinc-950 border-zinc-800 text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200 text-xs">
                    <SelectItem value="Asia/Pacific">Asia / Pacific (APAC)</SelectItem>
                    <SelectItem value="North America">North America (NA)</SelectItem>
                    <SelectItem value="Europe">Europe (EU)</SelectItem>
                    <SelectItem value="Latin America">Latin America (LATAM)</SelectItem>
                    <SelectItem value="Global">Global / Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Timezone *</Label>
                <Input
                  required
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="e.g. WIB (UTC+7), EST (UTC-5), CET (UTC+1)"
                  className="mt-1 bg-zinc-950 border-zinc-800 text-white text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Availability */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2 pb-2 border-b border-zinc-800">
              <Clock className="w-4 h-4 text-amber-400" /> Availability & Schedule
            </h3>

            <div className="space-y-4">
              <div>
                <Label className="text-xs text-zinc-400">Available Days & Hours *</Label>
                <Textarea
                  required
                  rows={2}
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  placeholder="e.g. Friday to Sunday between 18:00 - 23:00 WIB"
                  className="mt-1 bg-zinc-950 border-zinc-800 text-white text-xs"
                />
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Preferred Match Times *</Label>
                <Input
                  required
                  value={preferredMatchTimes}
                  onChange={(e) => setPreferredMatchTimes(e.target.value)}
                  placeholder="e.g. Weekend prime time slots, Saturday evenings"
                  className="mt-1 bg-zinc-950 border-zinc-800 text-white text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Experience & Scenarios */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2 pb-2 border-b border-zinc-800">
              <Award className="w-4 h-4 text-purple-400" /> Officiating Experience & Motivation
            </h3>

            <div className="space-y-4">
              <div>
                <Label className="text-xs text-zinc-400">Previous Referee / Moderation Experience *</Label>
                <Textarea
                  required
                  rows={3}
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="Describe any previous refereeing, tournament hosting, community moderation, or competitive gaming experience."
                  className="mt-1 bg-zinc-950 border-zinc-800 text-white text-xs"
                />
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Why do you want to become a CAA League Referee? *</Label>
                <Textarea
                  required
                  rows={3}
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  placeholder="What motivated you to apply, and how will you ensure fair, professional match management?"
                  className="mt-1 bg-zinc-950 border-zinc-800 text-white text-xs"
                />
              </div>

              <div>
                <Label className="text-xs text-zinc-400">Relevant Experience / Additional Details (Optional)</Label>
                <Textarea
                  rows={2}
                  value={relevantExperience}
                  onChange={(e) => setRelevantExperience(e.target.value)}
                  placeholder="Any additional information, Discord server links, references, or past tournament rulings."
                  className="mt-1 bg-zinc-950 border-zinc-800 text-white text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Code of Conduct & Agreement */}
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Official Referee Code of Conduct</h4>
              <ul className="text-xs text-zinc-400 space-y-1.5 list-disc list-inside">
                <li>Maintain absolute neutrality and declare any conflict of interest before accepting assignments.</li>
                <li>Never officiate matches involving a guild where you are a member or maintain personal affiliations.</li>
                <li>Strictly enforce server settings, map pool guidelines, and verify all player eligibility before starting fixtures.</li>
                <li>Submit official post-match reports within the mandatory 24-hour completion deadline.</li>
                <li>Document all technical pauses, disconnects, and in-match warnings accurately.</li>
              </ul>
            </div>

            <label className="flex items-start gap-3 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={rulesAgreed}
                onChange={(e) => setRulesAgreed(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs text-zinc-300 leading-relaxed">
                I hereby certify that all information provided is accurate, and I agree to strictly uphold the Official CAA League Referee Rules, neutrality standards, and disciplinary integrity policies.
              </span>
            </label>
          </div>

          <div className="flex justify-end pt-4 border-t border-zinc-800">
            <Button
              type="submit"
              disabled={isSubmitting || !rulesAgreed}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 text-xs gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Submit Referee Application</span>
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
