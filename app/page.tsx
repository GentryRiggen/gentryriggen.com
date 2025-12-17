import Hero from "@/components/Hero";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-gray-900 dark:text-white transition-colors overflow-visible">
      <ThemeToggle />
      <main className="overflow-visible">
        <Hero />
      </main>
    </div>
  );
}
