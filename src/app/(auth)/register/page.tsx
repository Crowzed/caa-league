'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Mail, Lock, User, UserPlus, ArrowLeft, AlertCircle, CheckCircle2, 
  Gamepad2, MessageSquare, Globe, Sparkles, Image as ImageIcon 
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImageUpload } from '@/components/ui/image-upload';

const AVATAR_PRESETS = [
  { name: 'Viper', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Viper&backgroundColor=030712' },
  { name: 'Apex', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Apex&backgroundColor=0f172a' },
  { name: 'Ghost', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Ghost&backgroundColor=18181b' },
  { name: 'Titan', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Titan&backgroundColor=1e1b4b' },
  { name: 'Blaze', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Blaze&backgroundColor=450a0a' },
  { name: 'Cyber', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Cyber&backgroundColor=022c22' },
];

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    username: '',
    display_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    roblox_username: '',
    roblox_id: '',
    discord_username: '',
    discord_id: '',
    region: 'NA',
    country: 'United States',
    timezone: 'UTC-5 (EST)',
    avatar_url: AVATAR_PRESETS[0].url,
    bio: ''
  });

  const supabase = createClient();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value
    });
  };

  const handleSelectPreset = (url: string) => {
    setFormData(prev => ({ ...prev, avatar_url: url }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validate inputs
    if (formData.password !== formData.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (formData.password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    const cleanUsername = formData.username.trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,20}$/.test(cleanUsername)) {
      setErrorMessage("Website Username must be 3-20 characters and contain only letters, numbers, hyphens or underscores.");
      return;
    }

    if (!formData.roblox_username.trim()) {
      setErrorMessage("Roblox Username is required.");
      return;
    }

    if (!formData.roblox_id.trim()) {
      setErrorMessage("Roblox User ID is required as your permanent identity identifier.");
      return;
    }

    if (!formData.discord_username.trim()) {
      setErrorMessage("Discord Username/Tag is required for league match coordination.");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Check if website username is already taken
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', cleanUsername)
        .maybeSingle();

      if (checkError) {
        console.warn('Username check note:', checkError);
      }

      if (existingUser) {
        setErrorMessage(`The website username "${cleanUsername}" is already taken. Please choose another.`);
        setIsLoading(false);
        return;
      }

      // 2. Perform Supabase Auth Sign Up
      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          data: {
            username: cleanUsername,
            display_name: formData.display_name.trim() || cleanUsername,
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // 3. Upsert player profile with all detailed fields
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          username: cleanUsername,
          display_name: formData.display_name.trim() || cleanUsername,
          email: formData.email.trim(),
          roblox_username: formData.roblox_username.trim(),
          roblox_id: formData.roblox_id.trim(),
          discord_username: formData.discord_username.trim(),
          discord_id: formData.discord_id.trim() || null,
          region: formData.region,
          country: formData.country.trim() || null,
          timezone: formData.timezone,
          avatar_url: formData.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`,
          bio: formData.bio.trim() || null,
          role: 'player',
          account_status: 'registered',
          guild_status: 'unaffiliated',
          is_verified: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        if (profileError) {
          console.error('Profile creation error:', profileError);
          // If upsert fails due to existing ID, we still inform user
        }

        setSuccessMessage('Account registered successfully! You are now listed in the global Players directory. Redirecting to login...');
        setTimeout(() => {
          router.push('/login?registered=true');
        }, 1800);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-2xl mx-auto py-8"
    >
      <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-2xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-linear-to-r from-blue-600 via-indigo-500 to-cyan-400 rounded-full blur-[2px]"></div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Official CAA League Registration
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Create Player Profile</h1>
          <p className="text-zinc-400 text-sm mt-1 max-w-md mx-auto">
            Complete your competitor identity to join tournament rosters and appear in the global Players directory.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* SECTION 1: Account Credentials */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
              <User className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Account Credentials</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs text-zinc-300 font-medium">
                  Website Username <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500 text-sm font-mono">@</span>
                  <Input
                    id="username"
                    type="text"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    placeholder="unique_handle"
                    className="pl-8 bg-zinc-950 border-zinc-800 focus:border-blue-500"
                  />
                </div>
                <p className="text-[11px] text-zinc-500">Unique identifier for your web profile URL and search.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="display_name" className="text-xs text-zinc-300 font-medium">
                  Display Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="display_name"
                  type="text"
                  value={formData.display_name}
                  onChange={handleChange}
                  required
                  placeholder="e.g. ShadowStrike"
                  className="bg-zinc-950 border-zinc-800 focus:border-blue-500"
                />
                <p className="text-[11px] text-zinc-500">Your public player name displayed in leaderboards & rosters.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-zinc-300 font-medium">
                Email Address <span className="text-red-400">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="player@example.com"
                  className="pl-9 bg-zinc-950 border-zinc-800 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs text-zinc-300 font-medium">
                  Password <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={8}
                    placeholder="Min. 8 characters"
                    className="pl-9 bg-zinc-950 border-zinc-800 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs text-zinc-300 font-medium">
                  Confirm Password <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    minLength={8}
                    placeholder="Re-enter password"
                    className="pl-9 bg-zinc-950 border-zinc-800 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Permanent Gaming & Social Identity */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
              <Gamepad2 className="w-4 h-4 text-green-400" />
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Gaming & Social Identity</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="roblox_username" className="text-xs text-zinc-300 font-medium">
                  Roblox Username <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="roblox_username"
                  type="text"
                  value={formData.roblox_username}
                  onChange={handleChange}
                  required
                  placeholder="e.g. RobloxGamer2026"
                  className="bg-zinc-950 border-zinc-800 focus:border-green-500"
                />
                <p className="text-[11px] text-zinc-500">Your current Roblox handle used in-game.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="roblox_id" className="text-xs text-zinc-300 font-medium">
                  Roblox User ID <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="roblox_id"
                  type="text"
                  value={formData.roblox_id}
                  onChange={handleChange}
                  required
                  placeholder="e.g. 182746284"
                  className="bg-zinc-950 border-zinc-800 focus:border-green-500 font-mono"
                />
                <p className="text-[11px] text-zinc-500">Permanent numeric ID (from your Roblox profile URL).</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="discord_username" className="text-xs text-zinc-300 font-medium">
                  Discord Username / Tag <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input
                    id="discord_username"
                    type="text"
                    value={formData.discord_username}
                    onChange={handleChange}
                    required
                    placeholder="e.g. shadow_player"
                    className="pl-9 bg-zinc-950 border-zinc-800 focus:border-indigo-500"
                  />
                </div>
                <p className="text-[11px] text-zinc-500">Used for match refereeing and captain comms.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="discord_id" className="text-xs text-zinc-300 font-medium">
                  Discord User ID <span className="text-zinc-500">(Optional)</span>
                </Label>
                <Input
                  id="discord_id"
                  type="text"
                  value={formData.discord_id}
                  onChange={handleChange}
                  placeholder="e.g. 719283746192847192"
                  className="bg-zinc-950 border-zinc-800 focus:border-indigo-500 font-mono"
                />
                <p className="text-[11px] text-zinc-500">Permanent Discord snowflake ID.</p>
              </div>
            </div>
          </div>

          {/* SECTION 3: Region & Timezone */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
              <Globe className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Region & Availability</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="region" className="text-xs text-zinc-300 font-medium">
                  Competitive Region <span className="text-red-400">*</span>
                </Label>
                <select
                  id="region"
                  value={formData.region}
                  onChange={handleChange}
                  className="w-full h-10 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-sm text-zinc-100 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="NA">North America (NA)</option>
                  <option value="EU">Europe (EU)</option>
                  <option value="APAC">Asia-Pacific (APAC)</option>
                  <option value="OCE">Oceania (OCE)</option>
                  <option value="SA">South America (SA)</option>
                  <option value="OTHER">Other / Global</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="country" className="text-xs text-zinc-300 font-medium">
                  Country <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="country"
                  type="text"
                  value={formData.country}
                  onChange={handleChange}
                  required
                  placeholder="e.g. United States"
                  className="bg-zinc-950 border-zinc-800 focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="timezone" className="text-xs text-zinc-300 font-medium">
                  Timezone <span className="text-red-400">*</span>
                </Label>
                <select
                  id="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  className="w-full h-10 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-sm text-zinc-100 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="UTC-8 (PST)">UTC-8 (PST / Pacific)</option>
                  <option value="UTC-7 (MST)">UTC-7 (MST / Mountain)</option>
                  <option value="UTC-6 (CST)">UTC-6 (CST / Central)</option>
                  <option value="UTC-5 (EST)">UTC-5 (EST / Eastern)</option>
                  <option value="UTC+0 (UTC/GMT)">UTC+0 (UTC / GMT)</option>
                  <option value="UTC+1 (CET)">UTC+1 (CET / Central Europe)</option>
                  <option value="UTC+2 (EET)">UTC+2 (EET / Eastern Europe)</option>
                  <option value="UTC+7 (WIB/ICT)">UTC+7 (WIB / Indochina)</option>
                  <option value="UTC+8 (SGT/CST)">UTC+8 (SGT / Asia East)</option>
                  <option value="UTC+9 (JST/KST)">UTC+9 (JST / KST)</option>
                  <option value="UTC+10 (AEST)">UTC+10 (AEST / Sydney)</option>
                  <option value="UTC+12 (NZST)">UTC+12 (NZST / Auckland)</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 4: Profile Picture & Bio */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
              <ImageIcon className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Profile Picture & Bio</h2>
            </div>

            <div className="space-y-4">
              <ImageUpload
                value={formData.avatar_url}
                onChange={(url: string) => setFormData(prev => ({ ...prev, avatar_url: url }))}
                bucket="avatars"
                label="Profile Picture (Upload Image)"
                description="Upload an avatar image from your device (PNG, JPG, WEBP, GIF up to 5MB)."
                shape="circle"
              />

              <div className="space-y-2 pt-1 border-t border-zinc-900">
                <Label className="text-[11px] text-zinc-400 font-medium">Or Pick an Instant Preset Avatar</Label>
                <div className="grid grid-cols-6 gap-2.5">
                  {AVATAR_PRESETS.map((preset) => {
                    const isSelected = formData.avatar_url === preset.url;
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => handleSelectPreset(preset.url)}
                        className={`relative rounded-xl overflow-hidden border transition-all p-1 flex flex-col items-center gap-1 ${
                          isSelected 
                            ? 'border-blue-500 ring-2 ring-blue-500/40 bg-blue-500/10' 
                            : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={preset.url} alt={preset.name} className="w-10 h-10 rounded-full object-cover" />
                        <span className="text-[10px] text-zinc-400 font-medium truncate max-w-full">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="bio" className="text-xs text-zinc-300 font-medium">
                  Player Bio <span className="text-zinc-500">(Optional)</span>
                </Label>
                <span className="text-[11px] text-zinc-500">{formData.bio.length}/300</span>
              </div>
              <textarea
                id="bio"
                rows={3}
                maxLength={300}
                value={formData.bio}
                onChange={handleChange}
                placeholder="Share your competitive background, main weapon/class, tournament goals, etc..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-linear-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl py-3.5 font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-base"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  <span>Register Competitor Profile</span>
                </>
              )}
            </button>
            <p className="text-center text-xs text-zinc-500 mt-3">
              By registering, your profile will immediately appear in the global Players directory as an unaffiliated free agent.
            </p>
          </div>
        </form>

        <p className="text-center text-sm text-zinc-400 mt-6 pt-6 border-t border-zinc-800/80">
          Already registered?{' '}
          <Link href="/login" className="text-white hover:text-blue-400 font-medium transition-colors inline-flex items-center gap-1 group">
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            Sign in to CAA League
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
