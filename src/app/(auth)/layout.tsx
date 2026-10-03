import Link from 'next/link';
import Image from 'next/image';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-50 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-900/20 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-900/10 blur-[120px]"></div>
      </div>

      {/* Minimal navbar */}
      <header className="w-full border-b border-zinc-800/50 glass absolute top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-center sm:justify-start">
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
            <span className="font-bold text-xl tracking-tight">CAA LEAGUE</span>
          </Link>
        </div>
      </header>

      {/* Centered content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 pt-24">
        {children}
      </main>
    </div>
  );
}
