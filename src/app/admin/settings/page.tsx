"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Check, RefreshCw, Shield, Bell, Award } from "lucide-react";

interface LeagueSettings {
  leagueName: string;
  shortTag: string;
  contactEmail: string;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  defaultFormat: string;
  minRosterSize: number;
  maxRosterSize: number;
  discordWebhook: string;
  robloxGroupId: string;
}

const defaultSettings: LeagueSettings = {
  leagueName: "Command An Army Competitive League",
  shortTag: "CAA League",
  contactEmail: "staff@caaleague.com",
  pointsWin: 3,
  pointsDraw: 1,
  pointsLoss: 0,
  defaultFormat: "bo5",
  minRosterSize: 5,
  maxRosterSize: 12,
  discordWebhook: "https://discord.com/api/webhooks/example/...",
  robloxGroupId: "12345678",
};

export default function SettingsAdmin() {
  const [settings, setSettings] = useState<LeagueSettings>(defaultSettings);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("caa_league_settings");
      if (saved) {
        setSettings(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("caa_league_settings", JSON.stringify(settings));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleReset = () => {
    if (confirm("Reset all settings to system defaults?")) {
      setSettings(defaultSettings);
      localStorage.removeItem("caa_league_settings");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="League Settings"
        description="Configure tournament scoring parameters, default match formats, roster limits, and integrations."
      />

      <form onSubmit={handleSave} className="space-y-6">
        {/* General Info */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-base text-slate-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-yellow-500" />
              General Identity & Branding
            </CardTitle>
            <CardDescription className="text-slate-400">
              Basic organization information presented across public headers and footers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lg_name">League Organization Name</Label>
                <Input
                  id="lg_name"
                  value={settings.leagueName}
                  onChange={(e) => setSettings({ ...settings, leagueName: e.target.value })}
                  className="bg-slate-950 border-slate-800"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lg_tag">Short Brand Acronym</Label>
                <Input
                  id="lg_tag"
                  value={settings.shortTag}
                  onChange={(e) => setSettings({ ...settings, shortTag: e.target.value })}
                  className="bg-slate-950 border-slate-800"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lg_email">Staff Contact Email</Label>
              <Input
                id="lg_email"
                type="email"
                value={settings.contactEmail}
                onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                className="bg-slate-950 border-slate-800"
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Competition & Standings Scoring */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-base text-slate-100 flex items-center gap-2">
              <Award className="w-4 h-4 text-yellow-500" />
              Scoring Rules & Match Defaults
            </CardTitle>
            <CardDescription className="text-slate-400">
              Define points awarded in standings and default series lengths.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pts_win">Points per Match Win</Label>
                <Input
                  id="pts_win"
                  type="number"
                  min={0}
                  value={settings.pointsWin}
                  onChange={(e) => setSettings({ ...settings, pointsWin: parseInt(e.target.value) || 0 })}
                  className="bg-slate-950 border-slate-800 font-mono text-center"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pts_draw">Points per Draw</Label>
                <Input
                  id="pts_draw"
                  type="number"
                  min={0}
                  value={settings.pointsDraw}
                  onChange={(e) => setSettings({ ...settings, pointsDraw: parseInt(e.target.value) || 0 })}
                  className="bg-slate-950 border-slate-800 font-mono text-center"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pts_loss">Points per Loss</Label>
                <Input
                  id="pts_loss"
                  type="number"
                  min={0}
                  value={settings.pointsLoss}
                  onChange={(e) => setSettings({ ...settings, pointsLoss: parseInt(e.target.value) || 0 })}
                  className="bg-slate-950 border-slate-800 font-mono text-center"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="def_fmt">Default Match Series</Label>
                <Select
                  value={settings.defaultFormat}
                  onValueChange={(val) => setSettings({ ...settings, defaultFormat: val })}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                    <SelectValue placeholder="Format" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="bo3">Best of 3 (Bo3)</SelectItem>
                    <SelectItem value="bo5">Best of 5 (Bo5)</SelectItem>
                    <SelectItem value="bo7">Best of 7 (Bo7)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="min_rost">Minimum Active Roster</Label>
                <Input
                  id="min_rost"
                  type="number"
                  min={3}
                  max={10}
                  value={settings.minRosterSize}
                  onChange={(e) => setSettings({ ...settings, minRosterSize: parseInt(e.target.value) || 5 })}
                  className="bg-slate-950 border-slate-800 font-mono text-center"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_rost">Maximum Roster Size</Label>
                <Input
                  id="max_rost"
                  type="number"
                  min={5}
                  max={30}
                  value={settings.maxRosterSize}
                  onChange={(e) => setSettings({ ...settings, maxRosterSize: parseInt(e.target.value) || 12 })}
                  className="bg-slate-950 border-slate-800 font-mono text-center"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-base text-slate-100 flex items-center gap-2">
              <Bell className="w-4 h-4 text-yellow-500" />
              External Integrations
            </CardTitle>
            <CardDescription className="text-slate-400">
              Community integrations and external platform configurations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Hidden for now: Discord Webhook Integration
            <div className="space-y-2">
              <Label htmlFor="int_discord">Discord Webhook (Announcements / Match Alerts)</Label>
              <Input
                id="int_discord"
                value={settings.discordWebhook}
                onChange={(e) => setSettings({ ...settings, discordWebhook: e.target.value })}
                placeholder="https://discord.com/api/webhooks/..."
                className="bg-slate-950 border-slate-800 font-mono text-xs"
              />
            </div>
            */}

            <div className="space-y-2">
              <Label htmlFor="int_roblox">Roblox Group ID</Label>
              <Input
                id="int_roblox"
                value={settings.robloxGroupId}
                onChange={(e) => setSettings({ ...settings, robloxGroupId: e.target.value })}
                placeholder="12345678"
                className="bg-slate-950 border-slate-800 font-mono text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Reset to Defaults
          </Button>

          <Button
            type="submit"
            className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium"
          >
            {isSaved ? (
              <>
                <Check className="w-4 h-4 mr-2" /> Settings Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" /> Save Configuration
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
