import RetroText from "./RetroText";

interface RetroLabelProps {
  /** What assistive tech reads (and what tests find). */
  label: string;
  /** Pixel text shown; defaults to the label in capitals. */
  text?: string;
  className?: string;
}

/** Pixel-font text with a real, readable label for screen readers. */
export default function RetroLabel({
  label,
  text,
  className,
}: RetroLabelProps) {
  return (
    <>
      <span className="sr-only">{label}</span>
      <RetroText text={text ?? label.toUpperCase()} className={className} />
    </>
  );
}
