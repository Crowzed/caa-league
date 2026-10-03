'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Bell, CheckCheck, Calendar, Shield, Swords, 
  Scale, UserCheck, Loader2, ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader, EmptyState } from '@/components/shared';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { Notification } from '@/types/database';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const supabase = createClient();

  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setNotifications(data as Notification[]);
      }
    } catch (err) {
      console.warn('Load notifications error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markAllRead = async () => {
    if (!userId) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const markSingleRead = async (id: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const getNotificationVisuals = (notif: Notification) => {
    const isDisciplinary = 
      notif.type === 'system' && 
      (notif.title.toLowerCase().includes('sanction') || 
       notif.title.toLowerCase().includes('discipline') ||
       notif.title.toLowerCase().includes('warning') ||
       (notif.link && notif.link.includes('/discipline/')));

    if (isDisciplinary) {
      return {
        icon: <Scale className="w-4 h-4 text-red-400" />,
        badgeColor: 'border-red-500/30 text-red-400 bg-red-500/10',
        badgeText: 'Disciplinary Notice',
        boxBorder: notif.is_read ? 'border-zinc-800' : 'border-red-500/40 bg-red-950/20 shadow-red-950/40',
      };
    }

    switch (notif.type) {
      case 'match_reminder':
        return {
          icon: <Calendar className="w-4 h-4 text-blue-400" />,
          badgeColor: 'border-blue-500/30 text-blue-400 bg-blue-500/10',
          badgeText: 'Match Alert',
          boxBorder: notif.is_read ? 'border-zinc-800' : 'border-blue-500/30 bg-blue-950/20',
        };
      case 'match_result':
        return {
          icon: <Swords className="w-4 h-4 text-green-400" />,
          badgeColor: 'border-green-500/30 text-green-400 bg-green-500/10',
          badgeText: 'Result Posted',
          boxBorder: notif.is_read ? 'border-zinc-800' : 'border-green-500/30 bg-green-950/20',
        };
      case 'season_announcement':
        return {
          icon: <Shield className="w-4 h-4 text-amber-400" />,
          badgeColor: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
          badgeText: 'League Update',
          boxBorder: notif.is_read ? 'border-zinc-800' : 'border-amber-500/30 bg-amber-950/20',
        };
      case 'roster_approval':
      case 'guild_invitation':
        return {
          icon: <UserCheck className="w-4 h-4 text-purple-400" />,
          badgeColor: 'border-purple-500/30 text-purple-400 bg-purple-500/10',
          badgeText: 'Roster / Guild',
          boxBorder: notif.is_read ? 'border-zinc-800' : 'border-purple-500/30 bg-purple-950/20',
        };
      default:
        return {
          icon: <Bell className="w-4 h-4 text-zinc-400" />,
          badgeColor: 'border-zinc-700 text-zinc-400 bg-zinc-800/40',
          badgeText: 'System Alert',
          boxBorder: notif.is_read ? 'border-zinc-800' : 'border-blue-500/30 bg-zinc-900/90',
        };
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const displayedNotifications = filter === 'unread' 
    ? notifications.filter((n) => !n.is_read) 
    : notifications;

  return (
    <div className="container py-8 max-w-4xl mx-auto space-y-8">
      <PageHeader
        title="Notification Center"
        subtitle="Manage official league notices, match alerts, roster approvals, and disciplinary decisions."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Notifications' },
        ]}
        action={
          unreadCount > 0 ? (
            <Button variant="outline" size="sm" onClick={markAllRead} className="gap-2 text-xs border-zinc-700">
              <CheckCheck className="w-4 h-4 text-blue-400" />
              Mark All as Read ({unreadCount})
            </Button>
          ) : undefined
        }
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <Button
          size="sm"
          variant={filter === 'all' ? 'default' : 'ghost'}
          onClick={() => setFilter('all')}
          className="text-xs h-8"
        >
          All Notifications ({notifications.length})
        </Button>
        <Button
          size="sm"
          variant={filter === 'unread' ? 'default' : 'ghost'}
          onClick={() => setFilter('unread')}
          className="text-xs h-8 gap-1.5"
        >
          Unread Only
          {unreadCount > 0 && (
            <Badge variant="destructive" className="h-4 px-1.5 text-[10px] ml-1">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-zinc-500 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="text-xs">Loading official notifications...</span>
        </div>
      ) : displayedNotifications.length === 0 ? (
        <EmptyState
          title={filter === 'unread' ? 'No unread notifications' : 'No notifications found'}
          description={
            filter === 'unread'
              ? "You've read all your notifications. Switch to 'All Notifications' to review past alerts."
              : 'You have no notices or disciplinary records logged on your account.'
          }
        />
      ) : (
        <div className="space-y-3">
          {displayedNotifications.map((notif) => {
            const visual = getNotificationVisuals(notif);
            return (
              <div
                key={notif.id}
                className={cn(
                  "p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
                  visual.boxBorder,
                  notif.is_read
                    ? "bg-zinc-900/30 text-zinc-400"
                    : "shadow-lg text-zinc-200"
                )}
              >
                <div className="flex items-start gap-3.5 flex-1">
                  <div className="p-2.5 rounded-lg bg-zinc-800/80 mt-0.5 shrink-0 border border-zinc-700/50">
                    {visual.icon}
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-sm text-white">{notif.title}</h4>
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", visual.badgeColor)}>
                        {visual.badgeText}
                      </Badge>
                      {!notif.is_read && (
                        <Badge className="text-[9px] h-4 bg-blue-600 text-white font-mono px-1.5">
                          NEW
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">{notif.message}</p>
                    <p className="text-[11px] text-zinc-500" suppressHydrationWarning>
                      {new Date(notif.created_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {!notif.is_read && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => markSingleRead(notif.id)}
                      className="text-xs text-zinc-400 hover:text-white h-8"
                    >
                      Mark read
                    </Button>
                  )}
                  {notif.link && (
                    <Link href={notif.link} onClick={() => markSingleRead(notif.id)}>
                      <Button size="sm" className="text-xs h-8 gap-1 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700">
                        View Details <ArrowRight className="w-3 h-3 ml-0.5" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
