/** The bordered welcome card Claude Code opens with. */
export default function WelcomeBox() {
  return (
    <div className="mb-5 rounded-md border border-term-accent/60 px-3 py-2 sm:px-4 sm:py-3">
      <p className="text-term-fg">
        <span className="text-term-accent">✻</span> Welcome to{" "}
        <span className="font-bold">gentry.code</span>!
      </p>
      <p className="mt-2 text-term-muted text-xs sm:text-sm">
        /help for commands, or tap a suggestion below
      </p>
      <p className="text-term-muted text-xs sm:text-sm">cwd: ~/gentry</p>
    </div>
  );
}
