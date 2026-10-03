"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Shield,
  Swords,
  Clock,
  Map as MapIcon,
  Newspaper,
  Book,
  AlertTriangle,
  Scale,
  Award,
  History,
  Settings,
  Menu,
  X,
  User as UserIcon,
  LogOut,
  ChevronRight,
  Trophy,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";

const sidebarLinks = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Seasons", href: "/admin/seasons", icon: Calendar },
  { name: "Divisions", href: "/admin/divisions", icon: Users },
  { name: "Standings", href: "/admin/standings", icon: Trophy },
  { name: "Guilds", href: "/admin/guilds", icon: Shield },
  { name: "Players", href: "/admin/players", icon: UserIcon },
  { name: "Roles & Perms", href: "/admin/roles", icon: ShieldCheck },
  { name: "Matches", href: "/admin/matches", icon: Swords },
  { name: "Schedule", href: "/admin/schedule", icon: Clock },
  { name: "Maps", href: "/admin/maps", icon: MapIcon },
  { name: "News", href: "/admin/news", icon: Newspaper },
  { name: "Rules", href: "/admin/rules", icon: Book },
  { name: "Protests", href: "/admin/protests", icon: AlertTriangle },
  { name: "Penalties", href: "/admin/penalties", icon: Scale },
  { name: "Referees", href: "/admin/referees", icon: Shield },
  { name: "Achievements", href: "/admin/achievements", icon: Award },
  { name: "Audit Logs", href: "/admin/audit-logs", icon: History },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminUser, setAdminUser] = useState<{ name: string; email: string }>({
    name: "Admin User",
    email: "admin@caaleague.com",
  });

  const supabase = createClient();

  useEffect(() => {
    async function loadAdminUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, username")
            .eq("id", user.id)
            .maybeSingle();

          setAdminUser({
            name: profile?.display_name || profile?.username || user.email?.split("@")[0] || "Admin",
            email: user.email || "admin@caaleague.com",
          });
        }
      } catch (err) {
        console.warn("Could not load admin user details:", err);
      }
    }
    loadAdminUser();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex">
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/80 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:shrink-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center px-6 border-b border-slate-800 shrink-0">
          <Link href="/admin" className="flex items-center gap-2 font-bold text-xl text-yellow-500">
            <Shield className="h-6 w-6" />
            <span>CAA Admin</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto lg:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {sidebarLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isActive
                    ? "bg-yellow-500/10 text-yellow-500 font-medium"
                    : "text-slate-400 hover:text-slate-50 hover:bg-slate-800/50"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="h-5 w-5" />
                <span>{link.name}</span>
                {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-800">
          <Button variant="outline" className="w-full justify-start text-slate-300 border-slate-700 hover:bg-slate-800" asChild>
            <Link href="/">
              <LogOut className="h-4 w-4 mr-2" />
              Exit Admin
            </Link>
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-16 shrink-0 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-slate-400 hover:text-white mr-4"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
            <h1 className="text-lg font-semibold text-slate-200 capitalize hidden sm:block">
              {pathname.split("/").pop() === "admin" ? "Dashboard" : pathname.split("/").pop()?.replace(/-/g, " ")}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative text-slate-400 hover:text-white">
              <AlertTriangle className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500"></span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                    <AvatarFallback>AD</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{adminUser.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{adminUser.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin/settings" className="flex items-center w-full cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-400 focus:text-red-300 cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
