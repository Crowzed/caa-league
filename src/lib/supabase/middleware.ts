import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public directory routes that must ALWAYS be accessible to everyone (guests, players, captains, etc.)
  if (pathname === '/referees' || pathname.startsWith('/referees/')) {
    return supabaseResponse;
  }

  // Exact route or subpath match helper
  const matchesRoute = (route: string) => pathname === route || pathname.startsWith(`${route}/`);

  const isDashboardRoute = matchesRoute('/dashboard');
  const isAdminRoute = matchesRoute('/admin');
  const isRefereePortalRoute = matchesRoute('/referee');

  const isProtectedPath = isDashboardRoute || isAdminRoute || isRefereePortalRoute;

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Admin-only routes
  if (isAdminRoute && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const userRole = profile?.role || (user.user_metadata?.role as string | undefined);
    let hasAdminAccess = userRole && ['admin', 'super_admin'].includes(userRole);

    if (!hasAdminAccess) {
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('roles(slug)')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (userRoles) {
        hasAdminAccess = userRoles.some((ur) => {
          const r = ur.roles as unknown as { slug?: string } | { slug?: string }[] | null;
          if (Array.isArray(r)) {
            return r.some((roleItem) => roleItem.slug && ['admin', 'super_admin'].includes(roleItem.slug));
          }
          return !!(r?.slug && ['admin', 'super_admin'].includes(r.slug));
        });
      }
    }

    if (!hasAdminAccess) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  // Referee Portal routes (e.g. /referee, /referee/match/[id]) - Staff Only
  if (isRefereePortalRoute && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const userRole = profile?.role || (user.user_metadata?.role as string | undefined);
    let hasRefereeAccess =
      userRole && ['referee', 'moderator', 'admin', 'super_admin'].includes(userRole);

    if (!hasRefereeAccess) {
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('roles(slug)')
        .eq('user_id', user.id)
        .eq('status', 'active');

      const allowedRefereeRoles = [
        'referee',
        'head_referee',
        'senior_referee',
        'trial_referee',
        'moderator',
        'admin',
        'super_admin',
      ];

      if (userRoles) {
        hasRefereeAccess = userRoles.some((ur) => {
          const r = ur.roles as unknown as { slug?: string } | { slug?: string }[] | null;
          if (Array.isArray(r)) {
            return r.some((roleItem) => roleItem.slug && allowedRefereeRoles.includes(roleItem.slug));
          }
          return !!(r?.slug && allowedRefereeRoles.includes(r.slug));
        });
      }
    }

    if (!hasRefereeAccess) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
