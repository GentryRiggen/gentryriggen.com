export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="pt-8 sm:pt-12 md:pt-16">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8 sm:mb-10 md:mb-12">
          <p className="text-gray-600 dark:text-gray-400 mb-6 sm:mb-8 text-base sm:text-lg">
            Let&apos;s build something incredible together.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <a
              href="https://github.com/gentryriggen"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 bg-gray-900/10 dark:bg-white/10 hover:bg-gray-900/20 dark:hover:bg-white/20 border border-gray-300/50 dark:border-white/20 rounded-full text-gray-900 dark:text-white font-medium transition-all text-sm"
            >
              GitHub
            </a>
            <a
              href="https://linkedin.com/in/gentryriggen"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 bg-gray-900/10 dark:bg-white/10 hover:bg-gray-900/20 dark:hover:bg-white/20 border border-gray-300/50 dark:border-white/20 rounded-full text-gray-900 dark:text-white font-medium transition-all text-sm"
            >
              LinkedIn
            </a>
          </div>
        </div>
        <div className="text-center pt-8 border-t border-gray-300/30 dark:border-white/10">
          <p className="text-gray-500 dark:text-gray-500 text-xs">
            © {currentYear} Gentry Riggen
          </p>
        </div>
      </div>
    </footer>
  );
}
