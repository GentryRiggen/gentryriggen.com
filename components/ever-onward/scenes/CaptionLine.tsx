/**
 * A scene caption line. On phones only the first clause shows, so the main
 * fact is never cut off mid-word; from `sm` up the rest follows.
 */
export default function CaptionLine({ text }: { text: string }) {
  const [first, ...rest] = text.split(" · ");
  return (
    <>
      {first}
      {rest.length > 0 && (
        <span className="hidden sm:inline"> · {rest.join(" · ")}</span>
      )}
    </>
  );
}
