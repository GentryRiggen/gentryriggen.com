import ThemeToggle from "@/components/ThemeToggle";
import Terminal from "@/components/designs/design1/Terminal";

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-green-400 transition-colors font-mono">
      {/* Subtle scanline overlay for CRT effect in dark mode */}
      <div
        className="fixed inset-0 pointer-events-none z-10 opacity-0 dark:opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.3) 1px, rgba(0,0,0,0.3) 2px)",
          backgroundSize: "100% 2px",
        }}
        aria-hidden="true"
      />

      {/* Background grid pattern */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.03] dark:opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,197,94,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.4) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
        aria-hidden="true"
      />

      <ThemeToggle />

      <main className="relative z-10 min-h-[100dvh] sm:min-h-0 max-w-3xl mx-auto px-0 sm:px-6 py-0 sm:py-16 flex flex-col">
        <Terminal />

        {/* Footer / copyright */}
        <footer className="py-4 sm:mt-8 text-center text-xs text-gray-400 dark:text-green-500/40 font-mono">
          <p>&copy; {new Date().getFullYear()} Gentry Riggen</p>
        </footer>
      </main>
    </div>
  );
}
