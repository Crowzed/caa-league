import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="bg-zinc-950 border-t border-zinc-900 pt-12 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-1 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4 group">
              <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-blue-500/30 flex items-center justify-center bg-zinc-900 shadow-sm">
                <Image
                  src="/logo.png"
                  alt="CAA League"
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="font-bold text-xl tracking-tight">CAA LEAGUE</span>
            </Link>
            <p className="text-zinc-400 text-sm mb-6">
              The premier competitive league for Command An Army. Join a guild, compete in seasons, and climb the ranks to become the ultimate commander.
            </p>
            <div className="flex gap-4">
              {/* Social placeholders */}
              <a href="#" className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#5865F2] transition-colors">
                <span className="sr-only">Discord</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6h0a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-2.5l-3-3h-3.5a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3h8Z"/><path d="m14 16-2 2-2-2"/></svg>
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#FF0000] transition-colors">
                <span className="sr-only">YouTube</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#1DA1F2] transition-colors">
                <span className="sr-only">Twitter</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold text-white mb-4">League</h3>
            <ul className="space-y-3 text-sm text-zinc-400">
              <li><Link href="/league" className="hover:text-white transition-colors">Standings</Link></li>
              <li><Link href="/matches" className="hover:text-white transition-colors">Recent Matches</Link></li>
              <li><Link href="/guilds" className="hover:text-white transition-colors">Top Guilds</Link></li>
              <li><Link href="/players" className="hover:text-white transition-colors">Player Rankings</Link></li>
              <li><Link href="/hall-of-fame" className="hover:text-white transition-colors">Hall of Fame</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-white mb-4">Community</h3>
            <ul className="space-y-3 text-sm text-zinc-400">
              <li><Link href="/news" className="hover:text-white transition-colors">News & Updates</Link></li>
              <li><Link href="/rules" className="hover:text-white transition-colors">Official Ruleset</Link></li>
              <li><Link href="/maps" className="hover:text-white transition-colors">Map Pool</Link></li>
              <li><a href="#" className="hover:text-white transition-colors">Discord Server</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Tournaments</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-white mb-4">Legal & Support</h3>
            <ul className="space-y-3 text-sm text-zinc-400">
              <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-zinc-500 text-sm">
            &copy; {new Date().getFullYear()} CAA League. All rights reserved.
          </p>
          <p className="text-zinc-600 text-xs text-center md:text-right max-w-md">
            Powered by Roblox. CAA League is a fan-made competitive community and is not affiliated with, endorsed, or sponsored by Roblox Corporation or the creators of Command An Army.
          </p>
        </div>
      </div>
    </footer>
  );
}
