const DOTS = ["bg-term-accent", "bg-term-ok", "bg-term-link", "bg-term-key"];

interface ThemeSwatchProps {
  themeId: string;
}

/** A small preview chip painted in a theme's own colours. */
export default function ThemeSwatch({ themeId }: ThemeSwatchProps) {
  return (
    <span
      data-term-theme={themeId}
      className="flex shrink-0 items-center gap-1 rounded border border-term-border bg-term-bg px-1.5 py-1"
      aria-hidden="true"
    >
      <span className="text-xs font-bold text-term-fg">Aa</span>
      {DOTS.map((dot) => (
        <span key={dot} className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      ))}
    </span>
  );
}
