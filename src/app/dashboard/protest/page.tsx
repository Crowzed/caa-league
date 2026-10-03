'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, Upload, CheckCircle2, Send 
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared';
import { sampleMatches } from '@/lib/sample-data';
import type { ProtestType } from '@/types/database';

export default function SubmitProtestPage() {
  const [matchId, setMatchId] = useState(sampleMatches[0]?.id || '');
  const [protestType, setProtestType] = useState<ProtestType>('rule_violation');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="container py-8 max-w-3xl mx-auto space-y-8">
      <PageHeader
        title="Submit Official Match Protest"
        subtitle="Report rule violations, exploit abuse, or player eligibility issues for referee and moderator review"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Submit Protest' },
        ]}
      />

      {submitted ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl border border-green-500/30 bg-green-500/5 p-8 text-center space-y-4"
        >
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto text-green-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white">Protest Submitted Successfully</h2>
          <p className="text-sm text-zinc-400 max-w-md mx-auto">
            Your case has been logged under Case ID <span className="font-mono text-white">#CASE-2026-884</span>. League moderators have been notified and will review the evidence in accordance with Rule 7.3.
          </p>
          <div className="pt-4 flex justify-center gap-3">
            <Link href="/dashboard">
              <Button variant="default">Return to Dashboard</Button>
            </Link>
            <Link href="/rules">
              <Button variant="outline">Review Disciplinary Rules</Button>
            </Link>
          </div>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6 bg-zinc-900/40 p-8 rounded-xl border border-zinc-800">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3 text-xs text-amber-300">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-semibold">Notice regarding official protests:</p>
              <p className="text-amber-300/80 mt-0.5">
                Protests must be submitted within 2 hours of match completion. Frivolous or bad-faith protests may result in administrative warnings or team point deductions under Rule 7.4.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="match">Target Match</Label>
            <Select value={matchId} onValueChange={setMatchId}>
              <SelectTrigger>
                <SelectValue placeholder="Select completed match" />
              </SelectTrigger>
              <SelectContent>
                {sampleMatches.length > 0 ? (
                  sampleMatches.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      Week {m.week}: {m.home_guild?.name || 'Home'} vs {m.away_guild?.name || 'Away'} ({m.status.toUpperCase()})
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    No completed matches found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Protest Category</Label>
            <Select value={protestType} onValueChange={(val) => setProtestType(val as ProtestType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select issue category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exploit">Game Exploit / Glitch Abuse</SelectItem>
                <SelectItem value="rule_violation">Rule Violation</SelectItem>
                <SelectItem value="player_eligibility">Player Eligibility / Ringing</SelectItem>
                <SelectItem value="match_issue">Technical / Match Server Issue</SelectItem>
                <SelectItem value="other">Other Inquiry</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Protest Title / Subject</Label>
            <Input
              id="title"
              placeholder="e.g. Opponent used unauthorized terrain glitch in Game 2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Detailed Description of Incident</Label>
            <Textarea
              id="description"
              rows={5}
              placeholder="Explain exactly what happened, timestamp/game number, affected units or rounds, and relevant rule references..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="evidence">Evidence Link (YouTube / Medal / Streamable / Imgur)</Label>
            <Input
              id="evidence"
              placeholder="https://youtu.be/... or screenshot URL"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
            />
            <p className="text-xs text-zinc-500">
              High quality video recording or clear screenshots are mandatory for exploit claims.
            </p>
          </div>

          <div className="border-2 border-dashed border-zinc-800 rounded-lg p-6 text-center hover:border-zinc-700 transition-colors cursor-pointer">
            <Upload className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-xs text-zinc-300 font-medium">Attach Screenshot / Evidence Files</p>
            <p className="text-xs text-zinc-500 mt-1">PNG, JPG, MP4 up to 50MB (Stored in protected Supabase Storage)</p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            <Link href="/dashboard">
              <Button type="button" variant="ghost">Cancel</Button>
            </Link>
            <Button type="submit" disabled={!title || !description} className="gap-2">
              <Send className="w-4 h-4" />
              File Official Protest
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
