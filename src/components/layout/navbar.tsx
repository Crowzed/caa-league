'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Search, LogIn, User as UserIcon, Settings, LogOut, Shield, ShieldCheck, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SearchDialog } from './search-dialog';
import { createClient } from '@/lib/supabase/client';
import { getUserRoles } from '@/lib/auth/permissions';
import type { UserActiveRole } from '@/types/database';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const NAV_LINKS = [
  { name: 'Home', href: '/' },
  { name: 'League', href: '/league' },
  { name: 'Live Now', href: '/live', badge: 'LIVE' },
  { name: 'Matches', href: '/matches' },
  { name: 'Guilds', href: '/guilds' },
  { name: 'Players', href: '/players' },
  { name: 'Maps', href: '/maps' },
  { name: 'Units', href: '/units' },
  { name: 'Statistics', href: '/statistics' },
  { name: 'News', href: '/news' },
  { name: 'Rules', href: '/rules' },
  { name: 'Referees', href: '/referees' },
  { name: 'Hall of Fame', href: '/hall-of-fame' },
];

interface NavProfile {
  id: string;
  username: string;
  display_name: string | null;
  role: string;
  avatar_url?: string | null;
}

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<NavProfile | null>(null);
  const [userRoles, setUserRoles] = useState<UserActiveRole[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const [prevPathname, setPrevPathname] = useState(pathname);
  
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsOpen(false);
  }

  const supabase = createClient();

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserEmail(user.email || null);
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, username, display_name, role, avatar_url')
            .eq('id', user.id)
            .maybeSingle();

          if (profile) {
            setUserProfile(profile as NavProfile);
          } else {
            setUserProfile({
              id: user.id,
              username: user.email?.split('@')[0] || 'User',
              display_name: user.email?.split('@')[0] || 'User',
              role: (user.user_metadata?.role as string) || 'player',
            });
          }

          // Load all active roles for the user
          const roles = await getUserRoles(supabase, user.id);
          setUserRoles(roles);

          // Fetch unread notifications count
          const { count } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_read', false);
          setUnreadNotifCount(count || 0);
        } else {
          setUserProfile(null);
          setUserRoles([]);
          setUserEmail(null);
          setUnreadNotifCount(0);
        }
      } catch (err) {
        console.warn('Navbar auth load note:', err);
      }
    }

    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUserProfile(null);
    setUserRoles([]);
    setUserEmail(null);
    router.push('/login');
    router.refresh();
  };

  const activeRoleSlugs = userRoles.map((r) => r.slug);
  const isAdmin =
    (userProfile && ['admin', 'super_admin'].includes(userProfile.role)) ||
    activeRoleSlugs.includes('admin') ||
    activeRoleSlugs.includes('super_admin');

  const isReferee =
    (userProfile && ['referee', 'moderator', 'admin', 'super_admin'].includes(userProfile.role)) ||
    activeRoleSlugs.some((s) =>
      ['referee', 'head_referee', 'senior_referee', 'trial_referee', 'moderator', 'admin', 'super_admin'].includes(s)
    );
  const isLoggedIn = !!userProfile;

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800 glass">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-blue-500/30 group-hover:glow-blue transition-all flex items-center justify-center bg-zinc-900 shadow-sm">
                <Image
                  src="/logo.png"
                  alt="CAA League"
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                  priority
                />
              </div>
              <span className="font-bold text-xl tracking-tight hidden sm:block">CAA LEAGUE</span>
            </Link>
            
            <nav className="hidden xl:flex items-center gap-1 text-sm font-medium">
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                const isLive = link.badge === 'LIVE';
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={cn(
                      "px-2.5 py-1.5 rounded-md transition-colors relative flex items-center gap-1.5 text-xs lg:text-sm",
                      isActive ? "text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                    )}
                  >
                    <span>{link.name}</span>
                    {isLive && (
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute bottom-0 left-2.5 right-2.5 h-[2px] bg-blue-500"
                        initial={false}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors flex items-center gap-2"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
              <span className="hidden md:inline-flex text-[10px] border border-zinc-700 bg-zinc-800 px-1 py-0.5 rounded text-zinc-400">Ctrl+K</span>
            </button>

            {/* Quick Portal Switcher - Only visible for authorized users */}
            {(isLoggedIn || isReferee || isAdmin) && (
              <div className="hidden lg:flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-xs">
                {isLoggedIn && (
                  <Link 
                    href="/dashboard"
                    className={cn(
                      "px-2 py-1 rounded transition-colors",
                      pathname.startsWith('/dashboard') ? "bg-blue-600 text-white font-bold" : "text-zinc-400 hover:text-white"
                    )}
                  >
                    Dashboard
                  </Link>
                )}
                {isReferee && (
                  <Link 
                    href="/referee"
                    className={cn(
                      "px-2 py-1 rounded transition-colors",
                      pathname.startsWith('/referee') ? "bg-amber-600 text-white font-bold" : "text-zinc-400 hover:text-white"
                    )}
                  >
                    Referee
                  </Link>
                )}
                {isAdmin && (
                  <Link 
                    href="/admin"
                    className={cn(
                      "px-2 py-1 rounded transition-colors",
                      pathname.startsWith('/admin') ? "bg-red-600 text-white font-bold" : "text-zinc-400 hover:text-white"
                    )}
                  >
                    Admin
                  </Link>
                )}
              </div>
            )}
            
            {/* Notification Bell */}
            {isLoggedIn && (
              <Link href="/dashboard/notifications" title="Notifications">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="relative h-8 w-8 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-800"
                >
                  <Bell className="h-4 w-4" />
                  {unreadNotifCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-zinc-950 animate-pulse">
                      {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                    </span>
                  )}
                </Button>
              </Link>
            )}

            {/* User Dropdown or Log In Button */}
            {isLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 flex items-center gap-2 px-2.5 rounded-full border border-zinc-800 hover:border-zinc-700 bg-zinc-900/80 cursor-pointer">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={userProfile?.avatar_url || ''} />
                      <AvatarFallback className="text-[10px] bg-blue-600 text-white font-bold">
                        {(userProfile?.display_name || userProfile?.username || 'U').substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-zinc-200 max-w-[100px] truncate hidden md:inline">
                      {userProfile?.display_name || userProfile?.username}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-zinc-950 border-zinc-800 text-zinc-200" align="end">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-white leading-none truncate">
                          {userProfile?.display_name || userProfile?.username}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {userRoles.length > 0 ? (
                          userRoles.map((r) => (
                            <Badge key={r.slug} variant="outline" className="text-[9px] uppercase px-1.5 py-0 border-zinc-700 text-blue-400">
                              {r.name}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0 border-zinc-700 text-blue-400">
                            {userProfile?.role.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs leading-none text-zinc-400 truncate">
                        {userEmail || `@${userProfile?.username}`}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/dashboard" className="flex items-center w-full">
                      <UserIcon className="mr-2 h-4 w-4 text-blue-400" />
                      <span>Dashboard</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/dashboard/notifications" className="flex items-center justify-between w-full">
                      <div className="flex items-center">
                        <Bell className="mr-2 h-4 w-4 text-amber-400" />
                        <span>Notifications</span>
                      </div>
                      {unreadNotifCount > 0 && (
                        <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
                          {unreadNotifCount}
                        </Badge>
                      )}
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/admin" className="flex items-center w-full text-red-400">
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Admin Panel</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {isReferee && (
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/referee" className="flex items-center w-full text-amber-400">
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        <span>Referee Desk</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/dashboard/settings" className="flex items-center w-full">
                      <Settings className="mr-2 h-4 w-4 text-zinc-400" />
                      <span>Account Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuItem onClick={handleSignOut} className="text-red-400 focus:text-red-300 cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link 
                href="/login" 
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-xs transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Log In</span>
              </Link>
            )}

            <button 
              className="xl:hidden p-2 text-zinc-400 hover:text-white"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="xl:hidden border-b border-zinc-800 glass overflow-hidden"
          >
            <div className="container mx-auto px-4 py-4 flex flex-col gap-1 max-h-[80vh] overflow-y-auto">
              {(isLoggedIn || isReferee || isAdmin) && (
                <>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-3 py-1">
                    Portals
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 px-3 pb-3 border-b border-zinc-800">
                    {isLoggedIn && (
                      <>
                        <Link href="/dashboard" className="text-center p-2 rounded bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-200">
                          Dashboard
                        </Link>
                        <Link href="/dashboard/notifications" className="text-center p-2 rounded bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5">
                          <span>Alerts</span>
                          {unreadNotifCount > 0 && (
                            <Badge variant="destructive" className="h-4 px-1 text-[9px]">
                              {unreadNotifCount}
                            </Badge>
                          )}
                        </Link>
                      </>
                    )}
                    {isReferee && (
                      <Link href="/referee" className="text-center p-2 rounded bg-amber-500/10 border border-amber-500/30 text-xs font-semibold text-amber-400">
                        Referee
                      </Link>
                    )}
                    {isAdmin && (
                      <Link href="/admin" className="text-center p-2 rounded bg-red-500/10 border border-red-500/30 text-xs font-semibold text-red-400">
                        Admin
                      </Link>
                    )}
                  </div>
                </>
              )}

              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-3 pt-2">
                Public League
              </div>
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={cn(
                      "px-3 py-2 rounded-md transition-colors text-sm font-medium flex items-center justify-between",
                      isActive ? "bg-blue-600/10 text-blue-400" : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    )}
                  >
                    <span>{link.name}</span>
                    {link.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-600 text-white font-bold animate-pulse">
                        {link.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
              
              <div className="pt-3 mt-2 border-t border-zinc-800">
                {isLoggedIn ? (
                  <div className="flex flex-col gap-2">
                    <div className="px-3 py-1 flex items-center justify-between text-xs text-zinc-400">
                      <span>Logged in as <strong className="text-white">{userProfile?.display_name || userProfile?.username}</strong></span>
                      <Badge variant="outline" className="text-[10px] uppercase border-zinc-700">{userProfile?.role}</Badge>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-red-400 rounded-md font-medium text-sm transition-colors border border-zinc-800"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                ) : (
                  <Link 
                    href="/login" 
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-sm transition-colors"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Log In or Register</span>
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </>
  );
}
