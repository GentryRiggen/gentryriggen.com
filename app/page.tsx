import Hero from "@/components/Hero";
import ThemeToggle from "@/components/ThemeToggle";
import AnimatedBackground from "@/components/AnimatedBackground";

export default function Home() {
  return (
    <div className="min-h-screen text-gray-900 dark:text-white transition-colors overflow-visible relative">
      <div className="fixed inset-0 bg-white dark:bg-slate-950 -z-20" />
      <AnimatedBackground />
      <ThemeToggle />
      <main className="overflow-visible relative z-10">
        <Hero />
      </main>
    </div>
  );
}
